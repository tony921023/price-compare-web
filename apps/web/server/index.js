import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

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

  // 預設區間（前端沒填就走預設）
  const lo0 = minPrice ?? 200;
  const hi0 = maxPrice ?? 9000;

  // 防呆：min/max 顛倒就交換
  const lo = Math.min(lo0, hi0);
  const hi = Math.max(lo0, hi0);

  // range 至少 1（避免除以 0 / %0）
  const range = Math.max(1, hi - lo + 1);

  // 同一個 q → 穩定落在 [lo..hi]
  const seed = hashToInt(q.trim().toLowerCase());
  const base = lo + (seed % range);

  // 平台 offset（也要被 clamp，避免超過 max）
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

    // 模擬延遲
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
});