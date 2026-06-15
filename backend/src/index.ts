import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { initDb } from './config/db';
import { initRedis } from './config/redis';
import { runMigrations } from './utils/migrate';
import { initWebSocket } from './services/websocket';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import accountRoutes from './routes/account.routes';
import transactionRoutes from './routes/transaction.routes';
import cardRoutes from './routes/card.routes';
import loanRoutes from './routes/loan.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';
async function bootstrap() {
const app = express(); const http = createServer(app);
app.use(cors({ origin: function(_o,cb){cb(null,true)}, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','Cookie'] }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
try { await initDb(); } catch(e) { console.error('[DB]', e.message); }
try { await runMigrations(); } catch(e) { console.error('[Migration]', e.message); }
try { await initRedis(); } catch(e) { console.error('[Redis]', e.message); }
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/cards', cardRoutes);
app.use('/api/v1/loans', loanRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use(errorHandler);
const PORT = Number(process.env.PORT ?? 4000);
http.listen(PORT, '0.0.0.0', () => { console.log('[Oakstone] Ready on 0.0.0.0:' + PORT); initWebSocket(http); });
}
bootstrap().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
