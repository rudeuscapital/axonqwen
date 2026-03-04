// src/pages/api/monitors.ts  (GET all monitors)
import type { APIRoute } from 'astro';
import { monitors } from '../../lib/server';

export const GET: APIRoute = () => {
  const list = Array.from(monitors.values()).map(({ id, url, condition, intervalMinutes, startedAt }) => ({
    id, url, condition, intervalMinutes, startedAt,
  }));
  return Response.json({ monitors: list, total: list.length });
};
