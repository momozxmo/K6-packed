import { Database } from 'sql.js';
import fs from 'fs';

export interface TestRecord {
    id?: number;
    target_url: string;
    auth_domain?: string | null;
    username: string;
    password: string;
    vus: number;
    duration: string;
    ramp_up: string;
    post_login_urls?: string | null;
    login_fields?: string | null;
    aspnet_mode?: number;
    status: string;
    started_at?: string | null;
    completed_at?: string | null;
    created_at?: string;
}

export interface ResultRecord {
    id?: number;
    test_id: number;
    total_requests?: number;
    avg_response_time?: number;
    min_response_time?: number;
    max_response_time?: number;
    p50_response_time?: number;
    p90_response_time?: number;
    p95_response_time?: number;
    p99_response_time?: number;
    throughput?: number;
    error_rate?: number;
    error_count?: number;
    total_data_received?: number;
    total_data_sent?: number;
    login_success_rate?: number;
    avg_login_duration?: number;
    successful_logins?: number;
    failed_logins?: number;
    raw_summary?: string;
    created_at?: string;
}

export interface MetricRecord {
    id?: number;
    test_id: number;
    timestamp: string;
    metric_name: string;
    metric_value: number;
    tags?: string | null;
}

export interface ConfigRecord {
    id?: number;
    name: string;
    config: string;
    created_at?: string;
    updated_at?: string;
}

// Helper: convert sql.js query result to array of objects
function queryAll(db: Database, sql: string, params?: any[]): any[] {
    const stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

function queryOne(db: Database, sql: string, params?: any[]): any | undefined {
    const results = queryAll(db, sql, params);
    return results.length > 0 ? results[0] : undefined;
}

export class DbService {
    private db: Database;
    private dbPath: string;

    constructor(db: Database, dbPath: string) {
        this.db = db;
        this.dbPath = dbPath;
    }

    /** Persist DB to disk */
    private save(): void {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
    }

    // ─── Tests ────────────────────────────────────────

    createTest(test: Omit<TestRecord, 'id' | 'created_at'>): TestRecord {
        this.db.run(
            `INSERT INTO tests (target_url, auth_domain, username, password, vus, duration, ramp_up, post_login_urls, login_fields, aspnet_mode, status, started_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [test.target_url, test.auth_domain || null, test.username, test.password,
             test.vus, test.duration, test.ramp_up, test.post_login_urls || null,
             test.login_fields || null, test.aspnet_mode || 0, test.status, test.started_at || null]
        );
        const id = queryOne(this.db, 'SELECT last_insert_rowid() as id')?.id;
        this.save();
        return this.getTest(id)!;
    }

    getTest(id: number): TestRecord | undefined {
        return queryOne(this.db, 'SELECT * FROM tests WHERE id = ?', [id]);
    }

    getAllTests(): TestRecord[] {
        return queryAll(this.db, 'SELECT * FROM tests ORDER BY created_at DESC');
    }

    getAllTestsWithResults(): any[] {
        return queryAll(this.db, `
            SELECT t.*, 
                   r.avg_response_time, r.p95_response_time, r.error_rate, r.error_count,
                   r.total_requests, r.throughput
            FROM tests t
            LEFT JOIN results r ON r.test_id = t.id
            ORDER BY t.created_at DESC
        `);
    }

    updateTestStatus(id: number, status: string, completedAt?: string): void {
        if (completedAt) {
            this.db.run('UPDATE tests SET status = ?, completed_at = ? WHERE id = ?', [status, completedAt, id]);
        } else {
            this.db.run('UPDATE tests SET status = ? WHERE id = ?', [status, id]);
        }
        this.save();
    }

    deleteTest(id: number): void {
        this.db.run('DELETE FROM metrics WHERE test_id = ?', [id]);
        this.db.run('DELETE FROM results WHERE test_id = ?', [id]);
        this.db.run('DELETE FROM tests WHERE id = ?', [id]);
        this.save();
    }

    // ─── Results ──────────────────────────────────────

    createResult(result: Omit<ResultRecord, 'id' | 'created_at'>): ResultRecord {
        this.db.run(
            `INSERT INTO results (test_id, total_requests, avg_response_time, min_response_time, max_response_time,
                p50_response_time, p90_response_time, p95_response_time, p99_response_time,
                throughput, error_rate, error_count, total_data_received, total_data_sent,
                login_success_rate, avg_login_duration, successful_logins, failed_logins, raw_summary)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [result.test_id, result.total_requests ?? 0, result.avg_response_time ?? 0,
             result.min_response_time ?? 0, result.max_response_time ?? 0,
             result.p50_response_time ?? 0, result.p90_response_time ?? 0,
             result.p95_response_time ?? 0, result.p99_response_time ?? 0,
             result.throughput ?? 0, result.error_rate ?? 0, result.error_count ?? 0,
             result.total_data_received ?? 0, result.total_data_sent ?? 0,
             result.login_success_rate ?? 0, result.avg_login_duration ?? 0,
             result.successful_logins ?? 0, result.failed_logins ?? 0,
             result.raw_summary || '{}']
        );
        this.save();
        return this.getResult(result.test_id)!;
    }

    getResult(testId: number): ResultRecord | undefined {
        return queryOne(this.db, 'SELECT * FROM results WHERE test_id = ?', [testId]);
    }

    // ─── Metrics ──────────────────────────────────────

    insertMetrics(metrics: Omit<MetricRecord, 'id'>[]): void {
        for (const m of metrics) {
            this.db.run(
                `INSERT INTO metrics (test_id, timestamp, metric_name, metric_value, tags)
                 VALUES (?, ?, ?, ?, ?)`,
                [m.test_id, m.timestamp, m.metric_name, m.metric_value, m.tags || null]
            );
        }
        this.save();
    }

    getMetrics(testId: number, metricName?: string): MetricRecord[] {
        if (metricName) {
            return queryAll(this.db,
                'SELECT * FROM metrics WHERE test_id = ? AND metric_name = ? ORDER BY timestamp',
                [testId, metricName]);
        }
        return queryAll(this.db,
            'SELECT * FROM metrics WHERE test_id = ? ORDER BY timestamp',
            [testId]);
    }

    // ─── Configs ──────────────────────────────────────

    createConfig(name: string, config: string): ConfigRecord {
        this.db.run('INSERT INTO configs (name, config) VALUES (?, ?)', [name, config]);
        const id = queryOne(this.db, 'SELECT last_insert_rowid() as id')?.id;
        this.save();
        return this.getConfig(id)!;
    }

    getConfig(id: number): ConfigRecord | undefined {
        return queryOne(this.db, 'SELECT * FROM configs WHERE id = ?', [id]);
    }

    getAllConfigs(): ConfigRecord[] {
        return queryAll(this.db, 'SELECT * FROM configs ORDER BY updated_at DESC');
    }

    deleteConfig(id: number): void {
        this.db.run('DELETE FROM configs WHERE id = ?', [id]);
        this.save();
    }

    /** Close the database */
    close(): void {
        this.save();
        this.db.close();
    }
}
