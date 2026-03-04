// src/pages/api/tasks/[id].ts
import type { APIRoute } from 'astro';
import { tasks, broadcast } from '../../../lib/server';

export const GET: APIRoute = ({ params }) => {
  const t = tasks.get(params.id!);
  if (!t) return Response.json({ error: 'Task not found' }, { status: 404 });
  return Response.json(t);
};

export const DELETE: APIRoute = ({ params }) => {
  const id = params.id!;
  if (!tasks.has(id)) return Response.json({ error: 'Task not found' }, { status: 404 });
  tasks.delete(id);
  broadcast({ type: 'task_deleted', id });
  return Response.json({ success: true, id });
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id!;
  const t = tasks.get(id);
  if (!t) return Response.json({ error: 'Task not found' }, { status: 404 });
  const patch = await request.json();
  const allowed = ['status', 'result', 'error', 'duration'];
  for (const key of Object.keys(patch)) {
    if (allowed.includes(key)) (t as any)[key] = patch[key];
  }
  broadcast({ type: 'task_updated', task: t });
  return Response.json(t);
};
