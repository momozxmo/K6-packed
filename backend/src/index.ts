import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { initializeDatabase } from './models/schema';
import { DbService } from './services/core/db.service';
import { K6RunnerService } from './services/k6/k6-runner.service';
import { EncryptionService } from './services/core/encryption.service';
import { setupWebSocket } from './websocket/progress';
import { createTestRoutes } from './routes/test.routes';
import { createResultRoutes } from './routes/result.routes';
import { createConfigRoutes } from './routes/config.routes';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '127.0.0.1';
const DB_PATH = path.resolve(process.env.DB_PATH || './data/k6-dashboard.db');
const backendRoot = path.resolve(__dirname, '..');

function resolveK6ScriptPath(): string {
    const envPath = process.env.K6_SCRIPT_PATH;

    if (!envPath) {
        return path.resolve(__dirname, './k6-scripts/cross-domain-login.js');
    }

    if (path.isAbsolute(envPath)) {
        return envPath;
    }

    const candidates = [
        path.resolve(backendRoot, envPath),
        path.resolve(__dirname, envPath),
        path.resolve(backendRoot, 'src', envPath),
    ];

    const existing = candidates.find(candidate => fs.existsSync(candidate));
    return existing || candidates[0];
}

const K6_SCRIPT_PATH = resolveK6ScriptPath();
const K6_BINARY_PATH = process.env.K6_BINARY_PATH || 'k6';
const MAX_CONCURRENT_TESTS = parseInt(process.env.MAX_CONCURRENT_TESTS || '3');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'k6dashboard2024securekey32chars!';

async function main() {
    // Initialize database (sql.js is async)
    const db = await initializeDatabase(DB_PATH);
    const dbService = new DbService(db, DB_PATH);
    const encryptionService = new EncryptionService(ENCRYPTION_KEY);
    const k6Runner = new K6RunnerService(dbService, encryptionService, K6_BINARY_PATH, K6_SCRIPT_PATH, MAX_CONCURRENT_TESTS);

    // Create Express app
    const app = express();
    const server = createServer(app);

    // Middleware
    app.use(cors({ origin: true }));
    app.use(express.json({ limit: '10mb' }));

    // API Routes
    app.use('/api/tests', createTestRoutes(dbService, k6Runner, encryptionService));
    app.use('/api/results', createResultRoutes(dbService));
    app.use('/api/configs', createConfigRoutes(dbService));

    // Health check
    app.get('/api/health', (_req, res) => {
        res.json({
            status: 'ok',
            runningTests: k6Runner.runningCount,
            timestamp: new Date().toISOString(),
        });
    });

    // Setup WebSocket
    setupWebSocket(server);

    // Start server
    server.listen(PORT, HOST, () => {
        console.log(`\nðŸš€ K6 Load Test Dashboard Backend`);
        console.log(`   Server:    http://${HOST}:${PORT}`);
        console.log(`   WebSocket: ws://${HOST}:${PORT}/ws/test/:id`);
        console.log(`   Database:  ${DB_PATH}`);
        console.log(`   k6 Binary: ${K6_BINARY_PATH}`);
        console.log(`   Max Tests: ${MAX_CONCURRENT_TESTS}\n`);
    });

    // Graceful shutdown
    const shutdown = () => {
        console.log('\nðŸ›‘ Shutting down...');
        k6Runner.killAll();
        dbService.close();
        server.close(() => {
            console.log('Server closed.');
            process.exit(0);
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
