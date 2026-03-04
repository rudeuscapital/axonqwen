// src/pages/api/health.ts
import type { APIRoute } from 'astro';
import { tasks, monitors } from '../../lib/server';

export const GET: APIRoute = () => {
  return Response.json({
    status:    'ok',
    platform:  'AxonQwen',
    version:   '1.0.0',
    uptime:    process.uptime(),
    tasks:     tasks.size,
    monitors:  monitors.size,
  });
};
