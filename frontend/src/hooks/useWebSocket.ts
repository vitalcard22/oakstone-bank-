/// <reference types="vite/client" />
import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/auth.store';

type Handler = (data: any) => void;

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000/ws';
const listeners = new Map<string, Set<Handler>>();
let   ws: WebSocket | null = null;
let   reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect(token: string) {
  if (ws?.readyState === WebSocket.OPEN) return;
  ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      listeners.get(msg.type)?.forEach((fn) => fn(msg.data));
      listeners.get('*')?.forEach((fn) => fn(msg));
    } catch { /* ignore parse errors */ }
  };

  ws.onclose = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      const t = useAuthStore.getState().accessToken;
      if (t) connect(t);
    }, 3000);
  };
}

export function useWebSocket(events: Record<string, Handler>) {
  const token    = useAuthStore((s) => s.accessToken);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const subscribe = useCallback((type: string, fn: Handler) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(fn);
    return () => listeners.get(type)?.delete(fn);
  }, []);

  useEffect(() => {
    if (!token) return;
    connect(token);
    const unsubs = Object.entries(eventsRef.current).map(([t, fn]) => subscribe(t, fn));
    return () => unsubs.forEach((u) => u());
  }, [token, subscribe]);
}
