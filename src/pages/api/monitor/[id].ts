// src/pages/api/monitor/[id].ts
import type { APIRoute } from 'astro';
import { monitors, log } from '../../../lib/server';

export const DELETE: APIRoute = ({ params }) => {
  const id = params.id!;
  const m  = monitors.get(id);
  if (!m) return Response.json({ error: 'Monitor not found' }, { status: 404 });
  clearInterval(m.timer);
  monitors.delete(id);
  log('INFO', `Monitor ${id} stopped`);
  return Response.json({ success: true, id });
};
