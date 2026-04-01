import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';

export async function initializeDatabase(dbPath: string): Promise<Database> {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const SQL = await initSqlJs();

    let db: Database;
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS tests (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            target_url  TEXT NOT NULL,
            auth_domain TEXT,
            username    TEXT NOT NULL,
            password    TEXT NOT NULL,
            vus         INTEGER NOT NULL DEFAULT 10,
            duration    TEXT NOT NULL DEFAULT '1m',
            ramp_up     TEXT NOT NULL DEFAULT '30s',
            post_login_urls TEXT,
            login_fields    TEXT,
            aspnet_mode     INTEGER DEFAULT 0,
            status      TEXT NOT NULL DEFAULT 'pending',
            started_at  TEXT,
            completed_at TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS results (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id             INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
            total_requests      INTEGER,
            avg_response_time   REAL,
            min_response_time   REAL,
            max_response_time   REAL,
            p50_response_time   REAL,
            p90_response_time   REAL,
            p95_response_time   REAL,
            p99_response_time   REAL,
            throughput          REAL,
            error_rate          REAL,
            error_count         INTEGER,
            total_data_received INTEGER,
            total_data_sent     INTEGER,
            login_success_rate  REAL,
            avg_login_duration  REAL,
            successful_logins   INTEGER,
            failed_logins       INTEGER,
            raw_summary         TEXT,
            created_at          TEXT DEFAULT (datetime('now'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS metrics (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id      INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
            timestamp    TEXT NOT NULL,
            metric_name  TEXT NOT NULL,
            metric_value REAL NOT NULL,
            tags         TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS configs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            config      TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        )
    `);

    db.run('CREATE INDEX IF NOT EXISTS idx_metrics_test_id ON metrics(test_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(test_id, timestamp)');
    db.run('CREATE INDEX IF NOT EXISTS idx_results_test_id ON results(test_id)');

    return db;
}
