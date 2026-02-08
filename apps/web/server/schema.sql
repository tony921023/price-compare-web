CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query      TEXT NOT NULL,
  min_price  INTEGER,
  max_price  INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, query)
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id           SERIAL PRIMARY KEY,
  watchlist_id INTEGER NOT NULL REFERENCES watchlist_items(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL,
  price        INTEGER NOT NULL,
  title        TEXT NOT NULL,
  url          TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_snap_wl ON price_snapshots(watchlist_id, collected_at DESC);

CREATE TABLE IF NOT EXISTS price_alerts (
  id             SERIAL PRIMARY KEY,
  watchlist_id   INTEGER NOT NULL REFERENCES watchlist_items(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL CHECK (platform IN ('momo','pchome','shopee')),
  target_price   INTEGER NOT NULL CHECK (target_price > 0),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  last_triggered TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(watchlist_id, platform)
);
