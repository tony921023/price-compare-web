// apps/web/server/index.js
import express from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import bcrypt from "bcryptjs";

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

app.use(express.json());

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

/* =========================
 *  Auth（暫存使用者：先不用 DB）
 * ========================= */

const users = new Map(); // key=email -> { id, email, passwordHash, createdAt }
let uid = 1;

function publicUser(u) {
  return { id: u.id, email: u.email, createdAt: u.createdAt };
}

function requireLogin(req, res, next) {
  if (!req.session?.uid) return res.status(401).json({ message: "not logged in" });
  next();
}

// 取得目前登入狀態
app.get("/api/auth/me", (req, res) => {
  const id = req.session?.uid;
  if (!id) return res.json({ user: null });

  const u = [...users.values()].find((x) => x.id === id);
  return res.json({ user: u ? publicUser(u) : null });
});

// 註冊（註冊完直接登入）
app.post("/api/auth/register", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!email || !password) return res.status(400).json({ message: "email/password required" });
    if (password.length < 6) return res.status(400).json({ message: "password too short" });
    if (users.has(email)) return res.status(409).json({ message: "email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: uid++, email, passwordHash, createdAt: new Date().toISOString() };
    users.set(email, user);

    req.session.uid = user.id;
    res.json({ user: publicUser(user) });
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

    const user = users.get(email);
    if (!user) return res.status(401).json({ message: "invalid email or password" });

    const ok = await bcrypt.compare(password, user.passwordHash);
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

// ✅ 之後你要做「追蹤清單」可以先用這個保護路由
app.get("/api/private/ping", requireLogin, (req, res) => {
  res.json({ ok: true, uid: req.session.uid });
});

/* =========================
 *  Search（demo 價格區間邏輯）
 * ========================= */

function hashToInt(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return h >>> 0;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function buildDemoItems(q, minPrice, maxPrice) {
  const now = new Date().toISOString();

  const lo0 = minPrice ?? 200;
  const hi0 = maxPrice ?? 9000;

  const lo = Math.min(lo0, hi0);
  const hi = Math.max(lo0, hi0);
  const range = Math.max(1, hi - lo + 1);

  const seed = hashToInt(q.trim().toLowerCase());
  const base = lo + (seed % range);

  const pchomePrice = clamp(base + 0, lo, hi);
  const shopeePrice = clamp(base + 120, lo, hi);
  const momoPrice = clamp(base + 240, lo, hi);

  const items = [
    {
      platform: "pchome",
      title: `${q}｜PChome（搜尋頁）`,
      price: pchomePrice,
      url: `https://24h.pchome.com.tw/search/?q=${encodeURIComponent(q)}`,
      updatedAt: now,
    },
    {
      platform: "shopee",
      title: `${q}｜蝦皮（搜尋頁）`,
      price: shopeePrice,
      url: `https://shopee.tw/search?keyword=${encodeURIComponent(q)}`,
      updatedAt: now,
    },
    {
      platform: "momo",
      title: `${q}｜momo（搜尋頁）`,
      price: momoPrice,
      url: `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${encodeURIComponent(q)}`,
      updatedAt: now,
    },
  ];

  const minP = Math.min(...items.map((x) => x.price));
  return items.map((x) => ({
    ...x,
    badge: x.price === minP ? "最低" : "可買",
  }));
}

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ items: [] });

    const minPrice = toNum(req.query.minPrice);
    const maxPrice = toNum(req.query.maxPrice);

    await new Promise((r) => setTimeout(r, 150));

    const items = buildDemoItems(q, minPrice, maxPrice);
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "internal error" });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`CORS origin allow: ${WEB_ORIGIN}`);
});