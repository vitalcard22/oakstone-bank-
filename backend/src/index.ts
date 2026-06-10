import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { initDb } from './config/db';
import { initRedis } from './config/redis';
import { initWebSocket } from './services/websocket';
import { errorHandler } from './middleware/errorHandler';
import authRoutes         from './routes/auth.routes';
import accountRoutes      from './routes/account.routes';
import transactionRoutes  from './routes/transaction.routes';
import cardRoutes         from './routes/card.routes';
import loanRoutes         from './routes/loan.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes        from './routes/admin.routes';

const app  = express();
const http = createServer(app);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
  skip: (req) => req.path === '/health',
}));

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

const v1 = '/api/v1';
app.use(`${v1}/auth`,          authRoutes);
app.use(`${v1}/accounts`,      accountRoutes);
app.use(`${v1}/transactions`,  transactionRoutes);
app.use(`${v1}/cards`,         cardRoutes);
app.use(`${v1}/loans`,         loanRoutes);
app.use(`${v1}/notifications`, notificationRoutes);
app.use(`${v1}/admin`,         adminRoutes);
app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 4000);
const HOST = '0.0.0.0';

http.listen(PORT, HOST, () => {
  console.log(`[Oakstone] Listening on ${HOST}:${PORT}`);
  initWebSocket(http);
});

(async () => {
  try { await initDb(); } catch (e: any) { console.error('[DB] Failed:', e.message); }
  try { await initRedis(); } catch (e: any) { console.error('[Redis] Failed:', e.message); }
})();