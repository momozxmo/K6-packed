import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { DbService } from '../core/db.service';
import { ResultParserService } from './result-parser.service';
import { EncryptionService } from '../core/encryption.service';
import { broadcastLog, broadcastProgress, broadcastComplete } from '../../websocket/progress';

interface TestConfig {
    targetUrl: string;
    authDomain?: string;
    username: string;
    password: string;
    vus: number;
    duration: string;
    rampUp: string;
    postLoginUrls?: string[];
    loginFieldUsername?: string;
    loginFieldPassword?: string;
    aspnetMode?: boolean;
}

export class K6RunnerService {
    private runningProcesses = new Map<number, ChildProcess>();
    private dbService: DbService;
    private resultParser: ResultParserService;
    private encryptionService: EncryptionService;
    private k6BinaryPath: string;
    private k6ScriptPath: string;
    private maxConcurrentTests: number;

    constructor(
        dbService: DbService,
        encryptionService: EncryptionService,
        k6BinaryPath: string,
        k6ScriptPath: string,
        maxConcurrentTests: number = 3
    ) {
        this.dbService = dbService;
        this.resultParser = new ResultParserService();
        this.encryptionService = encryptionService;
        this.k6BinaryPath = k6BinaryPath;
        this.k6ScriptPath = k6ScriptPath;
        this.maxConcurrentTests = maxConcurrentTests;
    }

    get runningCount(): number {
        return this.runningProcesses.size;
    }

    isRunning(testId: number): boolean {
        return this.runningProcesses.has(testId);
    }

    async runTest(testId: number, config: TestConfig): Promise<void> {
        if (this.runningProcesses.size >= this.maxConcurrentTests) {
            throw new Error(`Maximum concurrent tests (${this.maxConcurrentTests}) reached. Please wait for a test to complete.`);
        }

        // Create temp directory for this test's output
        const tmpDir = path.join(os.tmpdir(), `k6-test-${testId}`);
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const metricsFile = path.join(tmpDir, 'k6-metrics.json');
        const summaryFile = path.join(tmpDir, 'k6-summary.json');
        const scriptPath = path.resolve(this.k6ScriptPath);

        // Decrypt password for k6
        let plainPassword: string;
        try {
            plainPassword = this.encryptionService.decrypt(config.password);
        } catch {
            plainPassword = config.password; // Already plain (e.g., from dry-run)
        }

        const env: Record<string, string> = {
            ...process.env as Record<string, string>,
            TARGET_URL: config.targetUrl,
            AUTH_DOMAIN: config.authDomain || '',
            USERNAME: config.username,
            PASSWORD: plainPassword,
            VUS: String(config.vus),
            TEST_DURATION: config.duration,
            RAMP_UP: config.rampUp,
            POST_LOGIN_URLS: JSON.stringify(config.postLoginUrls || []),
            LOGIN_FIELD_USERNAME: config.loginFieldUsername || 'username',
            LOGIN_FIELD_PASSWORD: config.loginFieldPassword || 'password',
            ASPNET_MODE: config.aspnetMode ? 'true' : 'false',
        };

        const influxUrl = process.env.INFLUXDB_URL;

        const args = [
            'run',
            '--out', `json=${metricsFile}`,
            ...(influxUrl ? ['--out', `influxdb=${influxUrl}`] : []),
            '--summary-export', summaryFile,
            scriptPath,
        ];

        console.log(`[K6] Starting test ${testId}: ${this.k6BinaryPath} ${args.join(' ')}`);

        const k6Process = spawn(this.k6BinaryPath, args, {
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.runningProcesses.set(testId, k6Process);

        // Update test status
        this.dbService.updateTestStatus(testId, 'running');

        // Track progress parsing from k6 stdout + live metrics from json output
        let lastProgressParse = 0;
        let metricsReadOffset = 0;
        let metricsRemainder = '';
        const recentReqTimestamps: number[] = [];
        const recentRespSamples: { timestamp: number; value: number }[] = [];

        const trimRecentMetrics = (nowMs: number) => {
            while (recentReqTimestamps.length > 0 && nowMs - recentReqTimestamps[0] > 10000) {
                recentReqTimestamps.shift();
            }
            while (recentRespSamples.length > 0 && nowMs - recentRespSamples[0].timestamp > 10000) {
                recentRespSamples.shift();
            }
        };

        const collectLiveMetrics = (chunk: string) => {
            const combined = metricsRemainder + chunk;
            const lines = combined.split(/\r?\n/);
            metricsRemainder = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed.type !== 'Point') continue;

                    const metricName = parsed.metric;
                    const metricValue = parsed.data?.value;
                    const timestamp = parsed.data?.time ? new Date(parsed.data.time).getTime() : Date.now();

                    if (metricName === 'http_reqs') {
                        recentReqTimestamps.push(timestamp);
                    } else if (metricName === 'http_req_duration' && typeof metricValue === 'number') {
                        recentRespSamples.push({ timestamp, value: metricValue });
                    }
                } catch {
                    // Ignore malformed/incomplete NDJSON lines
                }
            }
        };

        const emitLiveMetricProgress = () => {
            if (!fs.existsSync(metricsFile)) return;

            try {
                const stats = fs.statSync(metricsFile);
                if (stats.size <= metricsReadOffset) return;

                const fd = fs.openSync(metricsFile, 'r');
                try {
                    const length = stats.size - metricsReadOffset;
                    const buffer = Buffer.alloc(length);
                    fs.readSync(fd, buffer, 0, length, metricsReadOffset);
                    metricsReadOffset = stats.size;
                    collectLiveMetrics(buffer.toString('utf-8'));
                } finally {
                    fs.closeSync(fd);
                }

                const nowMs = Date.now();
                trimRecentMetrics(nowMs);

                const requestsPerSec = recentReqTimestamps.length > 0
                    ? recentReqTimestamps.length / 10
                    : undefined;

                const avgResponseTime = recentRespSamples.length > 0
                    ? recentRespSamples.reduce((sum, sample) => sum + sample.value, 0) / recentRespSamples.length
                    : undefined;

                if (requestsPerSec !== undefined || avgResponseTime !== undefined) {
                    broadcastProgress(testId, {
                        requestsPerSec,
                        avgResponseTime,
                    });
                }
            } catch (err) {
                console.error(`[K6] Error reading live metrics for test ${testId}:`, err);
            }
        };

        const metricsInterval = setInterval(emitLiveMetricProgress, 1000);

        k6Process.stdout?.on('data', (data: Buffer) => {
            const output = data.toString();
            // Never log password
            const safeOutput = output.replace(new RegExp(plainPassword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
            broadcastLog(testId, safeOutput);

            // Try to parse progress info from k6 output
            const now = Date.now();
            if (now - lastProgressParse > 1000) {
                lastProgressParse = now;
                const progress = this.parseK6Progress(safeOutput);
                if (progress) {
                    broadcastProgress(testId, progress);
                }
            }
        });

        k6Process.stderr?.on('data', (data: Buffer) => {
            const output = data.toString();
            const safeOutput = output.replace(new RegExp(plainPassword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
            broadcastLog(testId, `[stderr] ${safeOutput}`);
        });

        k6Process.on('close', async (code) => {
            clearInterval(metricsInterval);
            emitLiveMetricProgress();
            console.log(`[K6] Test ${testId} completed with code ${code}`);
            this.runningProcesses.delete(testId);

            try {
                // Parse results
                const summary = this.resultParser.parseSummary(summaryFile);
                const timeSeriesPoints = await this.resultParser.parseMetricsStream(metricsFile);

                // Save results to DB
                this.dbService.createResult({
                    test_id: testId,
                    ...summary,
                    raw_summary: fs.existsSync(summaryFile) ? fs.readFileSync(summaryFile, 'utf-8') : '{}',
                });

                // Save time-series metrics (batch insert)
                if (timeSeriesPoints.length > 0) {
                    this.dbService.insertMetrics(
                        timeSeriesPoints.map(p => ({
                            test_id: testId,
                            timestamp: p.timestamp,
                            metric_name: p.metric_name,
                            metric_value: p.metric_value,
                            tags: p.tags,
                        }))
                    );
                }

                // Update status
                const status = code === 0 ? 'completed' : 'failed';
                this.dbService.updateTestStatus(testId, status, new Date().toISOString());

                broadcastComplete(testId, code);
            } catch (error) {
                console.error(`[K6] Error processing results for test ${testId}:`, error);
                this.dbService.updateTestStatus(testId, 'failed', new Date().toISOString());
                broadcastComplete(testId, code);
            }

            // Cleanup temp files
            try {
                if (fs.existsSync(tmpDir)) {
                    fs.rmSync(tmpDir, { recursive: true, force: true });
                }
            } catch (err) {
                console.error(`[K6] Error cleaning up temp dir:`, err);
            }
        });

        k6Process.on('error', (error) => {
            clearInterval(metricsInterval);
            console.error(`[K6] Process error for test ${testId}:`, error.message);
            this.runningProcesses.delete(testId);
            this.dbService.updateTestStatus(testId, 'failed', new Date().toISOString());
            broadcastLog(testId, `[error] ${error.message}`);
            broadcastComplete(testId, 1);
        });
    }

    async dryRun(config: TestConfig): Promise<{ success: boolean; message: string; output: string }> {
        return new Promise((resolve) => {
            const scriptPath = path.resolve(this.k6ScriptPath);

            let plainPassword: string;
            try {
                plainPassword = this.encryptionService.decrypt(config.password);
            } catch {
                plainPassword = config.password;
            }

            const env: Record<string, string> = {
                ...process.env as Record<string, string>,
                TARGET_URL: config.targetUrl,
                AUTH_DOMAIN: config.authDomain || '',
                USERNAME: config.username,
                PASSWORD: plainPassword,
                VUS: '1',
                TEST_DURATION: '1s',
                RAMP_UP: '0s',
                POST_LOGIN_URLS: '[]',
                LOGIN_FIELD_USERNAME: config.loginFieldUsername || 'username',
                LOGIN_FIELD_PASSWORD: config.loginFieldPassword || 'password',
                ASPNET_MODE: config.aspnetMode ? 'true' : 'false',
                DRY_RUN: 'true',
            };

            const args = ['run', '--iterations', '1', '--vus', '1', scriptPath];

            const k6Process = spawn(this.k6BinaryPath, args, {
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 30000,
            });

            let stdout = '';
            let stderr = '';

            k6Process.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            k6Process.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            k6Process.on('close', (code) => {
                const safeOutput = (stdout + stderr).replace(
                    new RegExp(plainPassword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***'
                );
                resolve({
                    success: code === 0,
                    message: code === 0 ? 'Dry run successful â€” login validated' : 'Dry run failed â€” check output for details',
                    output: safeOutput,
                });
            });

            k6Process.on('error', (error) => {
                resolve({
                    success: false,
                    message: `k6 process error: ${error.message}`,
                    output: error.message,
                });
            });
        });
    }

    stopTest(testId: number): boolean {
        const proc = this.runningProcesses.get(testId);
        if (proc) {
            proc.kill('SIGINT');
            this.dbService.updateTestStatus(testId, 'stopped', new Date().toISOString());
            return true;
        }
        return false;
    }

    /**
     * Kill all running k6 processes (for graceful server shutdown)
     */
    killAll(): void {
        for (const [testId, proc] of this.runningProcesses) {
            console.log(`[K6] Killing test ${testId}`);
            proc.kill('SIGKILL');
        }
        this.runningProcesses.clear();
    }

    private parseK6Progress(output: string): any {
        // Parse k6 progress output like: "running (02m30s), 10/10 VUs, 1234 complete and 0 interrupted iterations"
        const vuMatch = output.match(/(\d+)\/(\d+)\s*VUs/);
        const iterMatch = output.match(/(\d+)\s*complete/);
        const timeMatch = output.match(/running\s*\((\d+m\d+s|\d+s)\)/);

        if (vuMatch || iterMatch || timeMatch) {
            return {
                currentVUs: vuMatch ? parseInt(vuMatch[1]) : undefined,
                maxVUs: vuMatch ? parseInt(vuMatch[2]) : undefined,
                completedIterations: iterMatch ? parseInt(iterMatch[1]) : undefined,
                elapsedTime: timeMatch ? timeMatch[1] : undefined,
            };
        }

        return null;
    }
}
