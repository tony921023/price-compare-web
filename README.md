# PricePulse

Cross-platform price comparison website with weekly price trends and watchlist.

Compare prices across PChome, Shopee, and momo in one search.

## Architecture

```
Browser (React + Vite)
  |
  |  /api/*  (Vite proxy in dev)
  v
Express API server (:8787)
  |
  |  pg pool
  v
PostgreSQL 16 (:5432)
```

```
price-compare-web/
├── apps/web/
│   ├── src/                # React frontend (TypeScript)
│   │   ├── components/     # AuthModal, SearchCard
│   │   └── services/       # auth.ts, searchProducts.ts
│   ├── server/             # Express backend (Node.js)
│   │   ├── index.js        # API routes
│   │   ├── db.js           # PostgreSQL connection + init
│   │   ├── demo-items.js   # Demo price generation
│   │   └── schema.sql      # Database schema
│   └── package.json
├── docker-compose.yml      # PostgreSQL service
├── .env.example            # Required environment variables
└── .github/workflows/ci.yml
```

## Prerequisites

- **Node.js** >= 20
- **Docker** (for PostgreSQL)

## Quick Start

```bash
# 1. Clone & setup env
git clone <repo-url> && cd price-compare-web
cp .env.example .env
# Edit .env — at minimum set POSTGRES_PASSWORD

# 2. Start PostgreSQL
docker compose up -d

# 3. Start backend (auto-creates tables on first run)
cd apps/web/server
npm install
node index.js
# => DB connected. DB schema applied.
# => API server running on http://localhost:8787

# 4. Start frontend (new terminal)
cd apps/web
npm install
npm run dev
# => http://localhost:5173
```

Open **http://localhost:5173** in your browser.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_SECRET` | `dev-secret-change-me` | Cookie signing key (**required** in production) |
| `WEB_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `PORT` | `8787` | Backend listen port |
| `NODE_ENV` | - | Set `production` for secure cookies |
| `POSTGRES_USER` | `pp` | Database user |
| `POSTGRES_PASSWORD` | - | Database password (**required**) |
| `POSTGRES_DB` | `pricepulse` | Database name |
| `POSTGRES_HOST` | `localhost` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `DATABASE_URL` | - | Full connection string (overrides individual PG vars) |

## Scripts (apps/web)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + production build |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm test` | Run Vitest |

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 7
- **Backend:** Express 4, cookie-session, bcryptjs
- **Database:** PostgreSQL 16
- **Testing:** Vitest
- **CI:** GitHub Actions
