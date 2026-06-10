# Oakstone Bank

A production-grade digital banking platform — React + Node.js + PostgreSQL + Redis.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Real-time | WebSockets |
| Auth | JWT + TOTP MFA |
| Deploy | Fly.io (backend) + Vercel (frontend) |

## Local development

```bash
# Backend
cd backend && cp .env.example .env
npm install && npm run dev

# Frontend (new terminal)
cd frontend && cp .env.example .env
npm install && npm run dev
```

Open http://localhost:3000

See **DEPLOY.md** for full GitHub → Fly.io → Vercel → Namecheap guide.
