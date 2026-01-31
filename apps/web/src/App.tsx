import { useMemo, useState } from "react";
import "./App.css";

type Platform = "momo" | "pchome" | "shopee";
type Offer = {
  platform: Platform;
  title: string;
  price: number;
  url: string;
  updatedAt: string;
};

function formatTwd(n: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(n);
}

function platformLabel(p: Platform) {
  switch (p) {
    case "momo":
      return "momo";
    case "pchome":
      return "PChome";
    case "shopee":
      return "蝦皮";
  }
}

export default function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const offers: Offer[] = useMemo(
    () => [
      {
        platform: "momo",
        title: "（示範）AirPods Pro 2",
        price: 6990,
        url: "https://example.com",
        updatedAt: new Date().toISOString(),
      },
      {
        platform: "pchome",
        title: "（示範）AirPods Pro 2",
        price: 6790,
        url: "https://example.com",
        updatedAt: new Date().toISOString(),
      },
      {
        platform: "shopee",
        title: "（示範）AirPods Pro 2",
        price: 6880,
        url: "https://example.com",
        updatedAt: new Date().toISOString(),
      },
    ],
    []
  );

  const sorted = useMemo(() => [...offers].sort((a, b) => a.price - b.price), [offers]);
  const minPrice = sorted[0]?.price ?? 0;

  async function onSearch() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      {/* Top bar + Logo */}
      <div className="topbar">
        <div className="brand">
          <img
            src="/logo.svg"
            alt="PricePulse"
            className="logoImg"
          />
          <div className="brandTitle">
            <h1>PricePulse</h1>
            <span>跨平台比價・追蹤・趨勢</span>
          </div>
        </div>

        <div className="topActions">
          <span className="pill">MVP v0</span>
          <button className="btn" onClick={() => alert("先做 UI，下一步接登入/追蹤清單")}>
            追蹤清單
          </button>
        </div>
      </div>

      {/* Search glass card */}
      <div className="glass glassStrong cardHover searchCard">
        <div className="searchRow">
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：AirPods Pro 2 / iPhone 15 / SSD 1TB"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
          />
          <button className={`btn ${loading || !query.trim() ? "" : "btnPrimary"}`} onClick={onSearch} disabled={loading || !query.trim()}>
            {loading ? "搜尋中…" : "搜尋"}
          </button>
        </div>

        <div className="chips">
          {["假資料", "多平台比價", "下一步：追蹤/趨勢/提醒"].map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="glass cardHover" style={{ marginTop: 16 }}>
        <div className="tableHeader">
          <div>平台</div>
          <div>商品</div>
          <div>價格</div>
          <div>操作</div>
        </div>

        {sorted.map((o) => {
          const isBest = o.price === minPrice;
          return (
            <div key={o.platform} className="row">
              <div className="platform">
                <span>{platformLabel(o.platform)}</span>
                {isBest ? <span className="badgeBest">最低</span> : <span className="badgeOk">可買</span>}
              </div>

              <div className="title" title={o.title}>
                {o.title}
              </div>

              <div className="price">{formatTwd(o.price)}</div>

              <div>
                <a className="linkBtn" href={o.url} target="_blank" rel="noreferrer">
                  前往
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="footer">提示：接下來我們做「貼 URL 追蹤」→ 每週價格趨勢 → 目標價提醒。</div>
    </div>
  );
}