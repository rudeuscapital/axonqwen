// src/pages/api/vision/analyze.ts
import type { APIRoute } from 'astro';
import { createTask, updateTask, log } from '../../../lib/server';

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { instruction } = body;
  const task = createTask(`Vision: ${(instruction ?? 'analyze image').slice(0, 50)}`, 'vision');
  updateTask(task.id, { status: 'awaiting_ai' });
  log('INFO', `[${task.id}] Vision task created — awaiting client-side AI`);

  return Response.json({ taskId: task.id });
};
