import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';

const app  = express();
const http = createServer(app);

app.use(cors({
  origin: function(_origin, callback) { callback(null, true); },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Cookie'],
}));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

const PORT = Number(process.env.PORT ?? 4000);

http.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
  try { const { initDb } = await import('./config/db'); await initDb(); } catch(e: any) { console.error('[DB]', e.message); }
  try { const { initRedis } = await import('./config/redis'); await initRedis(); } catch(e: any) { console.error('[Redis]', e.message); }
  const { default: authRoutes } = await import('./routes/auth.routes');
  const { default: accountRoutes } = await import('./routes/account.routes');
  const { default: transactionRoutes } = await import('./routes/transaction.routes');
  const { default: cardRoutes } = await import('./routes/card.routes');
  const { default: loanRoutes } = await import('./routes/loan.routes');
  const { default: notificationRoutes } = await import('./routes/notification.routes');
  const { default: adminRoutes } = await import('./routes/admin.routes');
  const { errorHandler } = await import('./middleware/errorHandler');
  const { initWebSocket } = await import('./services/websocket');
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/accounts', accountRoutes);
  app.use('/api/v1/transactions', transactionRoutes);
  app.use('/api/v1/cards', cardRoutes);
  app.use('/api/v1/loans', loanRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use(errorHandler);
  initWebSocket(http);
  console.log('[Oakstone] All routes loaded');
});
