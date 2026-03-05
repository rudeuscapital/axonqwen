import { Router } from 'express';
import { tasks, broadcast } from '../store.js';

const router = Router();

// GET /api/tasks
router.get('/api/tasks', (_req, res) => {
  const list = Array.from(tasks.values()).sort((a, b) => b.id.localeCompare(a.id));
  res.json({ tasks: list, total: list.length });
});

// GET /api/tasks/:id
router.get('/api/tasks/:id', (req, res) => {
  const t = tasks.get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  res.json(t);
});

// DELETE /api/tasks/:id
router.delete('/api/tasks/:id', (req, res) => {
  const id = req.params.id;
  if (!tasks.has(id)) return res.status(404).json({ error: 'Task not found' });
  tasks.delete(id);
  broadcast({ type: 'task_deleted', id });
  res.json({ success: true, id });
});

// PATCH /api/tasks/:id
router.patch('/api/tasks/:id', (req, res) => {
  const id = req.params.id;
  const t = tasks.get(id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  const patch = req.body;
  const allowed = ['status', 'result', 'error', 'duration'];
  for (const key of Object.keys(patch)) {
    if (allowed.includes(key)) (t as any)[key] = patch[key];
  }
  broadcast({ type: 'task_updated', task: t });
  res.json(t);
});

export default router;
