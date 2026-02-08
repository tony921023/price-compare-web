// apps/web/server/demo-items.js
// Pure functions for demo price generation — extracted for testability.

function hashToInt(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return h >>> 0;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

// 用 seed 產生 0~1 之間的偽隨機數（不依賴 Math.random，保持可測試性）
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function buildDemoItems(q, minPrice, maxPrice) {
  const now = new Date().toISOString();

  const lo0 = minPrice ?? 200;
  const hi0 = maxPrice ?? 9000;

  const lo = Math.min(lo0, hi0);
  const hi = Math.max(lo0, hi0);
  const range = Math.max(1, hi - lo + 1);

  const seed = hashToInt(q.trim().toLowerCase());
  const base = lo + (seed % range);

  // 加入時間波動：每次呼叫價格會有 ±5% 的隨機變化，讓趨勢圖有意義
  const timeSeed = Date.now();
  const jitter = (platformOffset) => {
    const r = seededRandom(seed + timeSeed + platformOffset);
    return Math.round((r - 0.5) * 0.1 * base); // ±5%
  };

  const pchomePrice = clamp(base + 0 + jitter(1), lo, hi);
  const shopeePrice = clamp(base + 120 + jitter(2), lo, hi);
  const momoPrice = clamp(base + 240 + jitter(3), lo, hi);

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
