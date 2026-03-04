// src/pages/api/tasks/index.ts
import type { APIRoute } from 'astro';
import { tasks, broadcast } from '../../../lib/server';

export const GET: APIRoute = () => {
  const list = Array.from(tasks.values()).sort((a, b) => b.id.localeCompare(a.id));
  return Response.json({ tasks: list, total: list.length });
};
