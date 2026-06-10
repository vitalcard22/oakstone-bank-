import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDb } from '../config/db';

const r = Router();
r.use(authenticate);

r.get('/', async (req, res, next) => {
  try {
    const { rows } = await getDb().query(
      `SELECT id, title, body, is_read, created_at
       FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [(req as any).user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

r.patch('/:id/read', async (req, res, next) => {
  try {
    await getDb().query(
      'UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2',
      [req.params.id, (req as any).user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (e) { next(e); }
});

export default r;
