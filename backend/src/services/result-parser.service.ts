import fs from 'fs';
import readline from 'readline';

export interface ParsedSummary {
    total_requests: number;
    avg_response_time: number;
    min_response_time: number;
    max_response_time: number;
    p50_response_time: number;
    p90_response_time: number;
    p95_response_time: number;
    p99_response_time: number;
    throughput: number;
    error_rate: number;
    error_count: number;
    total_data_received: number;
    total_data_sent: number;
    login_success_rate: number;
    avg_login_duration: number;
    successful_logins: number;
    failed_logins: number;
}

export interface TimeSeriesPoint {
    timestamp: string;
    metric_name: string;
    metric_value: number;
    tags?: string;
}

export class ResultParserService {
    /**
     * Parse k6 summary JSON (from --summary-export)
     */
    parseSummary(filePath: string): ParsedSummary {
        if (!fs.existsSync(filePath)) {
            return this.emptyResult();
        }

        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(raw);
            const metrics = data.metrics || {};

            return {
                total_requests: this.getMetricCount(metrics, 'http_reqs'),
                avg_response_time: this.getMetricValue(metrics, 'http_req_duration', 'avg'),
                min_response_time: this.getMetricValue(metrics, 'http_req_duration', 'min'),
                max_response_time: this.getMetricValue(metrics, 'http_req_duration', 'max'),
                p50_response_time: this.getPercentile(metrics, 'http_req_duration', '0.5') || this.getMetricValue(metrics, 'http_req_duration', 'med'),
                p90_response_time: this.getPercentile(metrics, 'http_req_duration', '0.9') || this.getMetricValue(metrics, 'http_req_duration', 'p(90)'),
                p95_response_time: this.getPercentile(metrics, 'http_req_duration', '0.95') || this.getMetricValue(metrics, 'http_req_duration', 'p(95)'),
                p99_response_time: this.getPercentile(metrics, 'http_req_duration', '0.99') || this.getMetricValue(metrics, 'http_req_duration', 'p(99)'),
                throughput: this.getMetricValue(metrics, 'http_reqs', 'rate'),
                error_rate: this.getMetricValue(metrics, 'errors', 'rate') || 0,
                error_count: this.getMetricCount(metrics, 'errors') || 0,
                total_data_received: this.getMetricCount(metrics, 'data_received'),
                total_data_sent: this.getMetricCount(metrics, 'data_sent'),
                login_success_rate: this.calculateLoginSuccessRate(metrics),
                avg_login_duration: this.getMetricValue(metrics, 'login_duration', 'avg'),
                successful_logins: this.getMetricCount(metrics, 'successful_logins'),
                failed_logins: this.getMetricCount(metrics, 'failed_logins'),
            };
        } catch (error) {
            console.error('Error parsing summary:', error);
            return this.emptyResult();
        }
    }

    /**
     * Parse k6 NDJSON metrics stream (from --out json=file.json)
     * Returns time-series data points for charting
     */
    async parseMetricsStream(filePath: string): Promise<TimeSeriesPoint[]> {
        if (!fs.existsSync(filePath)) {
            return [];
        }

        const points: TimeSeriesPoint[] = [];
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        const relevantMetrics = new Set([
            'http_req_duration', 'http_reqs', 'http_req_failed',
            'vus', 'vus_max', 'data_received', 'data_sent',
            'login_duration', 'page_load_duration', 'errors',
            'successful_logins', 'failed_logins',
            'http_req_connecting', 'http_req_tls_handshaking',
            'http_req_waiting', 'http_req_sending', 'http_req_receiving',
        ]);

        for await (const line of rl) {
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'Point' && relevantMetrics.has(parsed.metric)) {
                    points.push({
                        timestamp: parsed.data?.time || new Date().toISOString(),
                        metric_name: parsed.metric,
                        metric_value: parsed.data?.value ?? 0,
                        tags: parsed.data?.tags ? JSON.stringify(parsed.data.tags) : undefined,
                    });
                }
            } catch {
                // Skip malformed lines
            }
        }

        return points;
    }

    private getMetricValue(metrics: any, name: string, stat: string): number {
        const metric = metrics[name];
        if (!metric) return 0;
        const values = metric.values || metric;
        return values[stat] ?? 0;
    }

    private getMetricCount(metrics: any, name: string): number {
        const metric = metrics[name];
        if (!metric) return 0;
        const values = metric.values || metric;
        return values.count ?? values.value ?? 0;
    }

    private getPercentile(metrics: any, name: string, p: string): number {
        const metric = metrics[name];
        if (!metric) return 0;
        const values = metric.values || metric;
        // k6 summary exports percentiles as "p(90)", "p(95)", etc.
        const pKey = `p(${parseFloat(p) * 100})`;
        return values[pKey] ?? 0;
    }

    private calculateLoginSuccessRate(metrics: any): number {
        const success = this.getMetricCount(metrics, 'successful_logins');
        const failed = this.getMetricCount(metrics, 'failed_logins');
        const total = success + failed;
        if (total === 0) return 0;
        return success / total;
    }

    private emptyResult(): ParsedSummary {
        return {
            total_requests: 0,
            avg_response_time: 0,
            min_response_time: 0,
            max_response_time: 0,
            p50_response_time: 0,
            p90_response_time: 0,
            p95_response_time: 0,
            p99_response_time: 0,
            throughput: 0,
            error_rate: 0,
            error_count: 0,
            total_data_received: 0,
            total_data_sent: 0,
            login_success_rate: 0,
            avg_login_duration: 0,
            successful_logins: 0,
            failed_logins: 0,
        };
    }
}
