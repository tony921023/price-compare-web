import express from "express";
import cors from "cors";

const app = express();

// 基本中介層
app.use(cors());
app.use(express.json());

/** 健康檢查：確認 server 有跑 */
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

/** 依 query 產生示範結果（後續可替換成真 API / 爬蟲） */
function buildDemoItems(q) {
  const now = new Date().toISOString();

  // 用 query 長度做個可變動的價格基準（只是 demo）
  const base = Math.max(199, Math.min(99999, q.length * 777));

  const items = [
    {
      platform: "pchome",
      title: `${q}｜PChome（示範）`,
      price: base + 0,
      url: "https://24h.pchome.com.tw/",
      updatedAt: now,
    },
    {
      platform: "shopee",
      title: `${q}｜蝦皮（示範）`,
      price: base + 120,
      url: "https://shopee.tw/",
      updatedAt: now,
    },
    {
      platform: "momo",
      title: `${q}｜momo（示範）`,
      price: base + 240,
      url: "https://www.momoshop.com.tw/brand/Main.jsp",
      updatedAt: now,
    },
  ];

  // 幫你加一個 badge（可選，前端想用就用）
  const minPrice = Math.min(...items.map((x) => x.price));
  return items.map((x) => ({
    ...x,
    badge: x.price === minPrice ? "最低" : "可買",
  }));
}

/**
 * 搜尋 API
 * GET /api/search?q=airpods
 * 回：{ items: Offer[] }
 */
app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ items: [] });

    // 模擬「查詢外部資料」的延遲（之後換真查詢可拿掉）
    await new Promise((r) => setTimeout(r, 250));

    const items = buildDemoItems(q);
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