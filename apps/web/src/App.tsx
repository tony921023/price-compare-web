import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { type Offer, type Platform } from "./services/searchProducts";
import { me, logout, type User } from "./services/auth";
import AuthModal from "./components/AuthModal";
import SearchCard from "./components/SearchCard";

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

type SortDir = "asc" | "desc";

export default function App() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [user, setUser] = useState<User | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    me()
      .then((u) => setUser(u))
      .catch(() => setUser(null));
  }, []);

  const sorted = useMemo(() => {
    const copy = [...offers];
    copy.sort((a, b) => {
      const diff = a.price - b.price;
      return sortDir === "asc" ? diff : -diff;
    });
    return copy;
  }, [offers, sortDir]);

  const minPrice = useMemo(() => {
    const prices = sorted.map((o) => o.price).filter((p) => typeof p === "number" && Number.isFinite(p));
    return prices.length ? Math.min(...prices) : null;
  }, [sorted]);

  async function doLogout() {
    try {
      await logout();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "登出失敗");
    } finally {
      setUser(null);
    }
  }

  return (
    <div className="page">
      {/* Top bar */}
      <div className="topbar">
        <div className="brand">
          <img src="/logo.svg" alt="PricePulse" className="logoImg" />
          <div className="brandTitle">
            <h1>PricePulse</h1>
            <span>跨平台比價・追蹤・趨勢</span>
          </div>
        </div>

        <div className="topActions">
          <span className="pill">MVP v0</span>

          {user ? (
            <>
              <span className="pill pillOk">已登入：{user.email}</span>
              <button className="btn" onClick={doLogout}>
                登出
              </button>
            </>
          ) : (
            <button className="btn btnPrimary" onClick={() => setAuthOpen(true)}>
              登入
            </button>
          )}

          <button className="btn" disabled title="即將推出">
            追蹤清單
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="hero">
        <div className="heroTitle">用 10 秒找到「相對合理」的價格區間</div>
        <div className="heroSub">先用搜尋頁 + 範圍過濾做 MVP；之後再換成平台官方/公開 API 或合作資料源。</div>
      </div>

      {/* Search card */}
      <SearchCard
        loggedIn={!!user}
        onResults={setOffers}
        onLoading={setLoading}
        onError={setError}
        error={error}
      />

      {/* Results */}
      <div className="glass cardHover" style={{ marginTop: 16 }}>
        <div className="tableHeader">
          <div>平台</div>
          <div>商品</div>
          <div className="priceHeader">
            價格
            <button className="sortBtn" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} type="button" title="切換排序">
              {sortDir === "asc" ? "↑" : "↓"}
            </button>
          </div>
          <div>操作</div>
        </div>

        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="row">
                <div className="platform">
                  <div className="skeleton skText" style={{ width: 90 }} />
                </div>
                <div className="title">
                  <div className="skeleton skText" style={{ width: "70%" }} />
                </div>
                <div className="price">
                  <div className="skeleton skText" style={{ width: 110 }} />
                </div>
                <div>
                  <div className="skeleton skBtn" />
                </div>
              </div>
            ))}
          </>
        ) : sorted.length === 0 ? (
          <div className="empty">
            <div className="emptyEmoji">🔎</div>
            <div className="emptyTitle">尚無結果</div>
            <div className="emptySub">輸入關鍵字後按「搜尋」，或直接點上面的熱門/最近。</div>
          </div>
        ) : (
          sorted.map((o, idx) => {
            const isBest = o.badge ? o.badge === "最低" : minPrice != null && o.price === minPrice;

            return (
              <div key={`${o.platform}-${o.url}-${idx}`} className="row">
                <div className="platform">
                  <span>{platformLabel(o.platform)}</span>
                  {isBest ? <span className="badgeBest">最低</span> : <span className="badgeOk">可買</span>}
                </div>

                <div className="title" title={o.title}>
                  {o.title}
                </div>

                <div className="price">{formatTwd(o.price)}</div>

                <div className="rowActions">
                  <a className="linkBtn" href={o.url} target="_blank" rel="noreferrer">
                    前往
                  </a>
                  <button
                    className="ghostBtn"
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(o.url).then(
                        () => { setCopiedUrl(o.url); setTimeout(() => setCopiedUrl(null), 1500); },
                        () => { setCopiedUrl(null); },
                      );
                    }}
                    title="複製連結"
                  >
                    {copiedUrl === o.url ? "已複製" : "複製"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="footer">提示：接下來做「登入後追蹤清單」→ 貼 URL 追蹤 → 每週趨勢 → 目標價提醒。</div>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onLogin={(u) => { setUser(u); setAuthOpen(false); }}
      />
    </div>
  );
}
