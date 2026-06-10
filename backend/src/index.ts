import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
const app = express();
const http = createServer(app);
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
const PORT = Number(process.env.PORT ?? 4000);
http.listen(PORT, '0.0.0.0', async () => {
  console.log('Server running on 0.0.0.0:' + PORT);
  try { const { initDb } = await import('./config/db'); await initDb(); } catch(e) { console.error('[DB]', e.message); }
  try { const { initRedis } = await import('./config/redis'); await initRedis(); } catch(e) { console.error('[Redis]', e.message); }
  const { default: authRoutes } = await import('./routes/auth.routes');
  const { default: accountRoutes } = await import('./routes/account.routes');
  const { default: transactionRoutes } = await import('./routes/transaction.routes');
  const { default: cardRoutes } = await import('./routes/card.routes');
  const { default: loanRoutes } = await import('./routes/loan.routes');
  const { default: notificationRoutes } = await import('./routes/notification.routes');
  const { default: adminRoutes } = await import('./routes/admin.routes');
  const { errorHandler } = await import('./middleware/errorHandler');
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/accounts', accountRoutes);
  app.use('/api/v1/transactions', transactionRoutes);
  app.use('/api/v1/cards', cardRoutes);
  app.use('/api/v1/loans', loanRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use(errorHandler);
  console.log('[Oakstone] All routes loaded');
});
