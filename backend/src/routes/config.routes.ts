import { Router, Request, Response } from 'express';
import { DbService } from '../services/core/db.service';

export function createConfigRoutes(dbService: DbService): Router {
    const router = Router();

    // POST /api/configs â€” Save a config
    router.post('/', (req: Request, res: Response) => {
        try {
            const { name, config } = req.body;
            if (!name || !config) {
                return res.status(400).json({ error: 'name and config are required' });
            }

            // Remove password from saved config for security
            const safeConfig = { ...config };
            delete safeConfig.password;

            const saved = dbService.createConfig(name, JSON.stringify(safeConfig));
            res.status(201).json(saved);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // GET /api/configs â€” Get all saved configs
    router.get('/', (_req: Request, res: Response) => {
        try {
            const configs = dbService.getAllConfigs().map(c => ({
                ...c,
                config: JSON.parse(c.config),
            }));
            res.json(configs);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // DELETE /api/configs/:id â€” Delete a config
    router.delete('/:id', (req: Request, res: Response) => {
        try {
            const id = parseInt(req.params.id as string);
            const config = dbService.getConfig(id);
            if (!config) {
                return res.status(404).json({ error: 'Config not found' });
            }
            dbService.deleteConfig(id);
            res.json({ message: 'Config deleted' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}
