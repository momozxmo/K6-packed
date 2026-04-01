import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer, IncomingMessage } from 'http';
import { parse } from 'url';

// Map of testId -> Set of connected WebSocket clients
const clients = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: HttpServer): void {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
        const { pathname } = parse(request.url || '');
        const match = pathname?.match(/^\/ws\/test\/(\d+)$/);

        if (match) {
            wss.handleUpgrade(request, socket, head, (ws) => {
                const testId = match[1];
                wss.emit('connection', ws, request, testId);
            });
        } else {
            socket.destroy();
        }
    });

    wss.on('connection', (ws: WebSocket, _request: IncomingMessage, testId: string) => {
        // Register client
        if (!clients.has(testId)) {
            clients.set(testId, new Set());
        }
        clients.get(testId)!.add(ws);

        console.log(`[WS] Client connected for test ${testId}`);

        ws.on('close', () => {
            const testClients = clients.get(testId);
            if (testClients) {
                testClients.delete(ws);
                if (testClients.size === 0) {
                    clients.delete(testId);
                }
            }
            console.log(`[WS] Client disconnected for test ${testId}`);
        });

        ws.on('error', (err) => {
            console.error(`[WS] Error for test ${testId}:`, err.message);
        });

        // Send initial acknowledgment
        ws.send(JSON.stringify({
            type: 'connected',
            testId,
            message: 'Connected to test progress stream',
        }));
    });
}

/**
 * Broadcast a log line to all clients watching a specific test
 */
export function broadcastLog(testId: string | number, log: string): void {
    const testClients = clients.get(String(testId));
    if (!testClients) return;

    const message = JSON.stringify({
        type: 'log',
        testId: String(testId),
        data: log,
        timestamp: new Date().toISOString(),
    });

    for (const ws of testClients) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    }
}

/**
 * Broadcast a parsed metric data point
 */
export function broadcastMetric(testId: string | number, metric: { name: string; value: number }): void {
    const testClients = clients.get(String(testId));
    if (!testClients) return;

    const message = JSON.stringify({
        type: 'metric',
        testId: String(testId),
        data: metric,
        timestamp: new Date().toISOString(),
    });

    for (const ws of testClients) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    }
}

/**
 * Broadcast progress update (percentage, current VUs, etc.)
 */
export function broadcastProgress(testId: string | number, progress: {
    percentage?: number;
    currentVUs?: number;
    requestsPerSec?: number;
    avgResponseTime?: number;
    errorCount?: number;
    elapsedTime?: string;
}): void {
    const testClients = clients.get(String(testId));
    if (!testClients) return;

    const message = JSON.stringify({
        type: 'progress',
        testId: String(testId),
        data: progress,
        timestamp: new Date().toISOString(),
    });

    for (const ws of testClients) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    }
}

/**
 * Broadcast test completion
 */
export function broadcastComplete(testId: string | number, exitCode: number | null): void {
    const testClients = clients.get(String(testId));
    if (!testClients) return;

    const message = JSON.stringify({
        type: 'complete',
        testId: String(testId),
        exitCode,
        timestamp: new Date().toISOString(),
    });

    for (const ws of testClients) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    }
}
