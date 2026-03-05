import { Router } from 'express';
import { createTask, updateTask, log } from '../store.js';

const router = Router();

router.post('/api/vision/analyze', (req, res) => {
  const { instruction } = req.body;
  const task = createTask(`Vision: ${(instruction ?? 'analyze image').slice(0, 50)}`, 'vision');
  updateTask(task.id, { status: 'awaiting_ai' });
  log('INFO', `[${task.id}] Vision task created — awaiting client-side AI`);
  res.json({ taskId: task.id });
});

export default router;
