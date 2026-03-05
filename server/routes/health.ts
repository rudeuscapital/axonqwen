import { Router } from 'express';
import { tasks, monitors } from '../store.js';

const router = Router();

router.get('/api/health', (_req, res) => {
  res.json({
    status:   'ok',
    platform: 'AxonQwen',
    version:  '1.0.0',
    uptime:   process.uptime(),
    tasks:    tasks.size,
    monitors: monitors.size,
  });
});

export default router;
