import { Router, Request, Response } from 'express';
import { DbService } from '../services/core/db.service';
import { K6RunnerService } from '../services/k6/k6-runner.service';
import { EncryptionService } from '../services/core/encryption.service';

export function createTestRoutes(dbService: DbService, k6Runner: K6RunnerService, encryption: EncryptionService): Router {
    const router = Router();

    // POST /api/tests â€” Create and start a new test
    router.post('/', async (req: Request, res: Response) => {
        try {
            const { targetUrl, authDomain, username, password, vus, duration, rampUp, postLoginUrls, loginFields, aspnetMode } = req.body;

            // Validation
            if (!targetUrl || !username || !password) {
                return res.status(400).json({ error: 'targetUrl, username, and password are required' });
            }

            if (vus && (vus < 1 || vus > 9999)) {
                return res.status(400).json({ error: 'VUs must be between 1 and 9999' });
            }

            try {
                new URL(targetUrl);
            } catch {
                return res.status(400).json({ error: 'Invalid target URL format' });
            }

            // Encrypt password before storing
            const encryptedPassword = encryption.encrypt(password);

            // Parse login fields
            let loginFieldUsername = 'username';
            let loginFieldPassword = 'password';
            if (loginFields) {
                loginFieldUsername = loginFields.username || 'username';
                loginFieldPassword = loginFields.password || 'password';
            }

            // Create test record
            const test = dbService.createTest({
                target_url: targetUrl,
                auth_domain: authDomain || null,
                username,
                password: encryptedPassword,
                vus: vus || 10,
                duration: duration || '1m',
                ramp_up: rampUp || '30s',
                post_login_urls: postLoginUrls ? JSON.stringify(postLoginUrls) : null,
                login_fields: loginFields ? JSON.stringify(loginFields) : null,
                aspnet_mode: aspnetMode ? 1 : 0,
                status: 'pending',
                started_at: new Date().toISOString(),
            });

            // Start the test
            k6Runner.runTest(test.id!, {
                targetUrl,
                authDomain,
                username,
                password: encryptedPassword,
                vus: vus || 10,
                duration: duration || '1m',
                rampUp: rampUp || '30s',
                postLoginUrls,
                loginFieldUsername,
                loginFieldPassword,
                aspnetMode,
            }).catch(err => {
                console.error(`Error running test ${test.id}:`, err);
                dbService.updateTestStatus(test.id!, 'failed', new Date().toISOString());
            });

            // Return immediately (test runs async)
            res.status(201).json({
                ...test,
                password: undefined, // Never return password
            });
        } catch (error: any) {
            console.error('Error creating test:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // GET /api/tests â€” Get all tests (with result metrics for history table)
    router.get('/', (_req: Request, res: Response) => {
        try {
            const tests = dbService.getAllTestsWithResults().map(t => ({
                ...t,
                password: undefined,
            }));
            res.json(tests);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // GET /api/tests/:id â€” Get single test
    router.get('/:id', (req: Request, res: Response) => {
        try {
            const test = dbService.getTest(parseInt(req.params.id as string));
            if (!test) {
                return res.status(404).json({ error: 'Test not found' });
            }
            res.json({ ...test, password: undefined });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // DELETE /api/tests/:id â€” Delete test
    router.delete('/:id', (req: Request, res: Response) => {
        try {
            const id = parseInt(req.params.id as string);
            const test = dbService.getTest(id);
            if (!test) {
                return res.status(404).json({ error: 'Test not found' });
            }
            if (k6Runner.isRunning(id)) {
                return res.status(400).json({ error: 'Cannot delete a running test. Stop it first.' });
            }
            dbService.deleteTest(id);
            res.json({ message: 'Test deleted' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // POST /api/tests/:id/stop â€” Stop a running test
    router.post('/:id/stop', (req: Request, res: Response) => {
        try {
            const id = parseInt(req.params.id as string);
            const stopped = k6Runner.stopTest(id);
            if (stopped) {
                res.json({ message: 'Test stop signal sent' });
            } else {
                res.status(404).json({ error: 'No running test found with this ID' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // POST /api/tests/dry-run â€” Dry run (test login only)
    router.post('/dry-run', async (req: Request, res: Response) => {
        try {
            const { targetUrl, authDomain, username, password, loginFields, aspnetMode } = req.body;

            if (!targetUrl || !username || !password) {
                return res.status(400).json({ error: 'targetUrl, username, and password are required' });
            }

            let loginFieldUsername = 'username';
            let loginFieldPassword = 'password';
            if (loginFields) {
                loginFieldUsername = loginFields.username || 'username';
                loginFieldPassword = loginFields.password || 'password';
            }

            const result = await k6Runner.dryRun({
                targetUrl,
                authDomain,
                username,
                password, // Pass plain for dry-run (not storing)
                vus: 1,
                duration: '1s',
                rampUp: '0s',
                loginFieldUsername,
                loginFieldPassword,
                aspnetMode,
            });

            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}
