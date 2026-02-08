// apps/web/server/index.js
import express from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { buildDemoItems } from "./demo-items.js";
import pool, { initDb } from "./db.js";

const app = express();
const isProd = process.env.NODE_ENV === "production";

// Production 啟動前檢查
if (isProd && !process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET is required in production. Exiting.");
  process.exit(1);
}

const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: (origin, cb) => {
      // 允許 curl / Postman（沒有 Origin） & 允許指定前端 origin
      if (!origin) return cb(null, true);
      if (origin === WEB_ORIGIN) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json({ limit: "100kb" }));

/**
 * ✅ cookie session
 * - 本機 http：secure 必須 false
 * - 上線 https：secure 改 true
 */
app.set("trust proxy", 1);
app.use(
  cookieSession({
    name: "pp_sess",
    keys: [process.env.SESSION_SECRET || "dev-secret-change-me"],
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
  })
);

/** 健康檢查 */
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "too many requests, try again later" },
});
app.use("/api/auth", authLimiter);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* =========================
 *  Auth（PostgreSQL）
 * ========================= */

function publicUser(row) {
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

function requireLogin(req, res, next) {
  if (!req.session?.uid) return res.status(401).json({ message: "not logged in" });
  next();
}

// 取得目前登入狀態
app.get("/api/auth/me", async (req, res) => {
  try {
    const id = req.session?.uid;
    if (!id) return res.json({ user: null });

    const { rows } = await pool.query("SELECT id, email, created_at FROM users WHERE id = $1", [id]);
    return res.json({ user: rows[0] ? publicUser(rows[0]) : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

// 註冊（註冊完直接登入）
app.post("/api/auth/register", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!email || !password) return res.status(400).json({ message: "email/password required" });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "invalid email" });
    if (password.length < 6) return res.status(400).json({ message: "password too short" });
    if (password.length > 128) return res.status(400).json({ message: "password too long" });

    const exists = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (exists.rows.length) return res.status(409).json({ message: "email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
      [email, passwordHash],
    );

    req.session.uid = rows[0].id;
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

// 登入
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!email || !password || !EMAIL_RE.test(email)) {
      return res.status(401).json({ message: "invalid email or password" });
    }

    const { rows } = await pool.query("SELECT id, email, password_hash, created_at FROM users WHERE email = $1", [email]);
    if (!rows.length) return res.status(401).json({ message: "invalid email or password" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "invalid email or password" });

    req.session.uid = user.id;
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

// 登出
app.post("/api/auth/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// 保護路由（追蹤清單用）
app.get("/api/private/ping", requireLogin, (req, res) => {
  res.json({ ok: true, uid: req.session.uid });
});

/* =========================
 *  Helpers
 * ========================= */

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* =========================
 *  Watchlist CRUD
 * ========================= */

// 列出追蹤清單
app.get("/api/watchlist", requireLogin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, query, min_price, max_price, created_at FROM watchlist_items WHERE user_id = $1 ORDER BY created_at DESC",
      [req.session.uid],
    );
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

// 加入追蹤（UPSERT）
app.post("/api/watchlist", requireLogin, async (req, res) => {
  try {
    const query = String(req.body?.query ?? "").trim();
    if (!query) return res.status(400).json({ message: "query required" });
    if (query.length > 200) return res.status(400).json({ message: "query too long" });

    const minPrice = toNum(req.body?.minPrice);
    const maxPrice = toNum(req.body?.maxPrice);

    if (minPrice != null && (minPrice < 0 || minPrice > 999999)) return res.status(400).json({ message: "minPrice out of range" });
    if (maxPrice != null && (maxPrice < 0 || maxPrice > 999999)) return res.status(400).json({ message: "maxPrice out of range" });

    const { rows } = await pool.query(
      `INSERT INTO watchlist_items (user_id, query, min_price, max_price)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, query) DO UPDATE SET min_price = $3, max_price = $4
       RETURNING id, query, min_price, max_price, created_at`,
      [req.session.uid, query, minPrice, maxPrice],
    );
    res.json({ item: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

// 移除追蹤
app.delete("/api/watchlist/:id", requireLogin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });

    const { rowCount } = await pool.query(
      "DELETE FROM watchlist_items WHERE id = $1 AND user_id = $2",
      [id, req.session.uid],
    );
    if (!rowCount) return res.status(404).json({ message: "not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

/* =========================
 *  Snapshots
 * ========================= */

// 檢查快照是否觸發提醒
async function checkAlerts(watchlistId, items, now) {
  const { rows: alerts } = await pool.query(
    "SELECT id, platform, target_price FROM price_alerts WHERE watchlist_id = $1 AND is_active = true",
    [watchlistId],
  );
  for (const alert of alerts) {
    const match = items.find((i) => i.platform === alert.platform && i.price <= alert.target_price);
    if (match) {
      await pool.query("UPDATE price_alerts SET last_triggered = $1 WHERE id = $2", [now, alert.id]);
    }
  }
}

// 對單一追蹤項目收集快照
app.post("/api/watchlist/:id/snapshot", requireLogin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });

    const { rows: wlRows } = await pool.query(
      "SELECT id, query, min_price, max_price FROM watchlist_items WHERE id = $1 AND user_id = $2",
      [id, req.session.uid],
    );
    if (!wlRows.length) return res.status(404).json({ message: "not found" });

    const wl = wlRows[0];
    const items = buildDemoItems(wl.query, wl.min_price, wl.max_price);
    const now = new Date().toISOString();

    for (const item of items) {
      await pool.query(
        "INSERT INTO price_snapshots (watchlist_id, platform, price, title, url, collected_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [wl.id, item.platform, item.price, item.title, item.url, now],
      );
    }

    await checkAlerts(wl.id, items, now);

    res.json({ ok: true, count: items.length, collectedAt: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

// 對所有追蹤項目批次快照
app.post("/api/watchlist/snapshot-all", requireLogin, async (req, res) => {
  try {
    const { rows: wlRows } = await pool.query(
      "SELECT id, query, min_price, max_price FROM watchlist_items WHERE user_id = $1",
      [req.session.uid],
    );

    const now = new Date().toISOString();
    let total = 0;

    for (const wl of wlRows) {
      const items = buildDemoItems(wl.query, wl.min_price, wl.max_price);
      for (const item of items) {
        await pool.query(
          "INSERT INTO price_snapshots (watchlist_id, platform, price, title, url, collected_at) VALUES ($1, $2, $3, $4, $5, $6)",
          [wl.id, item.platform, item.price, item.title, item.url, now],
        );
      }
      await checkAlerts(wl.id, items, now);
      total += items.length;
    }

    res.json({ ok: true, items: wlRows.length, total, collectedAt: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

/* =========================
 *  History / Trends
 * ========================= */

app.get("/api/watchlist/:id/history", requireLogin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });

    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);

    const { rows: wlRows } = await pool.query(
      "SELECT id, query FROM watchlist_items WHERE id = $1 AND user_id = $2",
      [id, req.session.uid],
    );
    if (!wlRows.length) return res.status(404).json({ message: "not found" });

    const { rows: history } = await pool.query(
      `SELECT platform, price, collected_at FROM price_snapshots
       WHERE watchlist_id = $1 AND collected_at >= now() - $2::interval
       ORDER BY collected_at ASC`,
      [id, `${days} days`],
    );

    res.json({ query: wlRows[0].query, history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

/* =========================
 *  Alerts CRUD
 * ========================= */

const VALID_PLATFORMS = ["momo", "pchome", "shopee"];

// 列出某追蹤項目的提醒
app.get("/api/watchlist/:id/alerts", requireLogin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });

    // 檢查歸屬
    const { rows: wlRows } = await pool.query(
      "SELECT id FROM watchlist_items WHERE id = $1 AND user_id = $2",
      [id, req.session.uid],
    );
    if (!wlRows.length) return res.status(404).json({ message: "not found" });

    const { rows } = await pool.query(
      "SELECT id, platform, target_price, is_active, last_triggered, created_at FROM price_alerts WHERE watchlist_id = $1 ORDER BY created_at DESC",
      [id],
    );
    res.json({ alerts: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

// 建立/更新提醒（UPSERT）
app.post("/api/watchlist/:id/alerts", requireLogin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });

    const platform = String(req.body?.platform ?? "").trim().toLowerCase();
    const targetPrice = toNum(req.body?.targetPrice);

    if (!VALID_PLATFORMS.includes(platform)) return res.status(400).json({ message: "invalid platform" });
    if (targetPrice == null || targetPrice <= 0 || targetPrice > 999999) return res.status(400).json({ message: "invalid targetPrice" });

    // 檢查歸屬
    const { rows: wlRows } = await pool.query(
      "SELECT id FROM watchlist_items WHERE id = $1 AND user_id = $2",
      [id, req.session.uid],
    );
    if (!wlRows.length) return res.status(404).json({ message: "not found" });

    const { rows } = await pool.query(
      `INSERT INTO price_alerts (watchlist_id, platform, target_price)
       VALUES ($1, $2, $3)
       ON CONFLICT (watchlist_id, platform) DO UPDATE SET target_price = $3, is_active = true
       RETURNING id, platform, target_price, is_active, last_triggered, created_at`,
      [id, platform, targetPrice],
    );
    res.json({ alert: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

// 刪除提醒
app.delete("/api/watchlist/:wid/alerts/:aid", requireLogin, async (req, res) => {
  try {
    const wid = Number(req.params.wid);
    const aid = Number(req.params.aid);
    if (!Number.isFinite(wid) || !Number.isFinite(aid)) return res.status(400).json({ message: "invalid id" });

    // 檢查歸屬
    const { rows: wlRows } = await pool.query(
      "SELECT id FROM watchlist_items WHERE id = $1 AND user_id = $2",
      [wid, req.session.uid],
    );
    if (!wlRows.length) return res.status(404).json({ message: "not found" });

    const { rowCount } = await pool.query(
      "DELETE FROM price_alerts WHERE id = $1 AND watchlist_id = $2",
      [aid, wid],
    );
    if (!rowCount) return res.status(404).json({ message: "alert not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

// 最近 7 天觸發過的提醒
app.get("/api/alerts/triggered", requireLogin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pa.id, pa.platform, pa.target_price, pa.last_triggered, wi.query
       FROM price_alerts pa
       JOIN watchlist_items wi ON pa.watchlist_id = wi.id
       WHERE wi.user_id = $1 AND pa.last_triggered IS NOT NULL AND pa.last_triggered >= now() - interval '7 days'
       ORDER BY pa.last_triggered DESC`,
      [req.session.uid],
    );
    res.json({ alerts: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

/* =========================
 *  Search（demo 價格區間邏輯）
 * ========================= */

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ items: [] });
    if (q.length > 200) return res.status(400).json({ message: "query too long" });

    const minPrice = toNum(req.query.minPrice);
    const maxPrice = toNum(req.query.maxPrice);

    if (minPrice != null && (minPrice < 0 || minPrice > 999999)) return res.status(400).json({ message: "minPrice out of range" });
    if (maxPrice != null && (maxPrice < 0 || maxPrice > 999999)) return res.status(400).json({ message: "maxPrice out of range" });

    await new Promise((r) => setTimeout(r, 150));

    const items = buildDemoItems(q, minPrice, maxPrice);
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API server running on http://localhost:${PORT}`);
      console.log(`CORS origin allow: ${WEB_ORIGIN}`);
    });
  })
  .catch((err) => {
    console.error("FATAL: DB init failed:", err.message);
    process.exit(1);
  });