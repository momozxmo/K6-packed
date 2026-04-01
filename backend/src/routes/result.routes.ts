import { Router, Request, Response } from 'express';
import { DbService } from '../services/db.service';

export function createResultRoutes(dbService: DbService): Router {
    const router = Router();

    // GET /api/results/:testId — Get results for a test
    router.get('/:testId', (req: Request, res: Response) => {
        try {
            const testId = parseInt(req.params.testId);
            const result = dbService.getResult(testId);
            if (!result) {
                return res.status(404).json({ error: 'Results not found for this test' });
            }

            // Also get time-series metrics
            const metrics = dbService.getMetrics(testId);

            // Group metrics by name for frontend charting
            const groupedMetrics: Record<string, { timestamp: string; value: number }[]> = {};
            for (const m of metrics) {
                if (!groupedMetrics[m.metric_name]) {
                    groupedMetrics[m.metric_name] = [];
                }
                groupedMetrics[m.metric_name].push({
                    timestamp: m.timestamp,
                    value: m.metric_value,
                });
            }

            res.json({
                summary: result,
                metrics: groupedMetrics,
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // GET /api/results/:testId/export/json — Export raw JSON
    router.get('/:testId/export/json', (req: Request, res: Response) => {
        try {
            const testId = parseInt(req.params.testId);
            const result = dbService.getResult(testId);
            if (!result) {
                return res.status(404).json({ error: 'Results not found' });
            }

            const rawSummary = result.raw_summary ? JSON.parse(result.raw_summary) : {};

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=k6-results-test-${testId}.json`);
            res.json(rawSummary);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // GET /api/results/:testId/export/csv — Export CSV summary
    router.get('/:testId/export/csv', (req: Request, res: Response) => {
        try {
            const testId = parseInt(req.params.testId);
            const result = dbService.getResult(testId);
            if (!result) {
                return res.status(404).json({ error: 'Results not found' });
            }

            const headers = [
                'Metric', 'Value'
            ].join(',');

            const rows = [
                `Total Requests,${result.total_requests}`,
                `Avg Response Time (ms),${result.avg_response_time?.toFixed(2)}`,
                `Min Response Time (ms),${result.min_response_time?.toFixed(2)}`,
                `Max Response Time (ms),${result.max_response_time?.toFixed(2)}`,
                `P50 Response Time (ms),${result.p50_response_time?.toFixed(2)}`,
                `P90 Response Time (ms),${result.p90_response_time?.toFixed(2)}`,
                `P95 Response Time (ms),${result.p95_response_time?.toFixed(2)}`,
                `P99 Response Time (ms),${result.p99_response_time?.toFixed(2)}`,
                `Throughput (req/s),${result.throughput?.toFixed(2)}`,
                `Error Rate,${((result.error_rate || 0) * 100).toFixed(2)}%`,
                `Error Count,${result.error_count}`,
                `Total Data Received (bytes),${result.total_data_received}`,
                `Total Data Sent (bytes),${result.total_data_sent}`,
                `Login Success Rate,${((result.login_success_rate || 0) * 100).toFixed(2)}%`,
                `Avg Login Duration (ms),${result.avg_login_duration?.toFixed(2)}`,
                `Successful Logins,${result.successful_logins}`,
                `Failed Logins,${result.failed_logins}`,
            ];

            const csv = [headers, ...rows].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=k6-results-test-${testId}.csv`);
            res.send(csv);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}
