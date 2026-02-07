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
 *  Search（demo 價格區間邏輯）
 * ========================= */

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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