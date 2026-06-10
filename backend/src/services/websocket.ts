import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

interface AuthSocket extends WebSocket {
  userId?: string;
  role?:   string;
  alive:   boolean;
}

const userSockets  = new Map<string, Set<AuthSocket>>();
const adminSockets = new Set<AuthSocket>();

export function initWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Heartbeat — disconnect dead connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((raw) => {
      const ws = raw as AuthSocket;
      if (!ws.alive) { ws.terminate(); return; }
      ws.alive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (raw: AuthSocket, req) => {
    raw.alive = true;

    // Auth via ?token= query param
    const url   = new URL(req.url!, `ws://${req.headers.host}`);
    const token = url.searchParams.get('token');
    if (!token) { raw.close(1008, 'Missing token'); return; }

    try {
      const p = jwt.verify(token, process.env.JWT_SECRET!) as any;
      raw.userId = p.sub;
      raw.role   = p.role;
    } catch {
      raw.close(1008, 'Invalid token');
      return;
    }

    // Register
    if (!userSockets.has(raw.userId!)) userSockets.set(raw.userId!, new Set());
    userSockets.get(raw.userId!)!.add(raw);
    if (raw.role === 'admin' || raw.role === 'super_admin') adminSockets.add(raw);

    raw.on('pong', () => { raw.alive = true; });
    raw.on('close', () => {
      userSockets.get(raw.userId!)?.delete(raw);
      adminSockets.delete(raw);
    });

    raw.send(JSON.stringify({ type: 'connected', ts: Date.now() }));
  });

  console.log('[WS] Ready');
}

function send(ws: AuthSocket, payload: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function emitToUser(userId: string, type: string, data: object): void {
  const payload = { type, data, ts: Date.now() };
  userSockets.get(userId)?.forEach((ws) => send(ws, payload));
}

export function emitAdmin(type: string, data: object): void {
  const payload = { type, data, ts: Date.now() };
  adminSockets.forEach((ws) => send(ws, payload));
}
