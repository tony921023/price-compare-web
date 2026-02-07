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

export function buildDemoItems(q, minPrice, maxPrice) {
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
