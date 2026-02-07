import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { searchProducts, type Offer, type Platform } from "./services/searchProducts";
import { me, login, register, logout, type User } from "./services/auth";

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

function parsePriceInput(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const HOT_KEYWORDS = ["AirPods Pro 2", "iPhone 15", "SSD 1TB", "鍵盤", "耳機", "牙膏"];
const PRICE_PRESETS: Array<{ label: string; min?: number; max?: number }> = [
  { label: "不限" },
  { label: "1k~3k", min: 1000, max: 3000 },
  { label: "3k~6k", min: 3000, max: 6000 },
  { label: "6k~9k", min: 6000, max: 9000 },
];

type SortDir = "asc" | "desc";

export default function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [minPriceText, setMinPriceText] = useState("");
  const [maxPriceText, setMaxPriceText] = useState("");

  const [offers, setOffers] = useState<Offer[]>([]);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [user, setUser] = useState<User | null>(null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("pp_recent");
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return Array.isArray(arr) ? arr.slice(0, 6) : [];
    } catch {
      return [];
    }
  });

  // ✅ 即時搜尋：取消上一筆
  const abortRef = useRef<AbortController | null>(null);

  // ✅ 避免「剛載入 / 剛 setQuery」就馬上打 API（需要時才打）
  const mountedRef = useRef(false);

  function pushRecent(q: string) {
    const s = q.trim();
    if (!s) return;
    const next = [s, ...recent.filter((x) => x !== s)].slice(0, 6);
    setRecent(next);
    localStorage.setItem("pp_recent", JSON.stringify(next));
  }

  function removeRecent(q: string) {
    const next = recent.filter((x) => x !== q);
    setRecent(next);
    localStorage.setItem("pp_recent", JSON.stringify(next));
  }

  // 初次載入：抓登入狀態
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

  // ✅ 實際打 API 的函式（支援 Abort + 可傳 nextQ）
  async function doSearch(opts?: { nextQ?: string }) {
    const nextQ = opts?.nextQ;

    const q = (nextQ ?? query).trim();

    // 空字：清空結果就好
    if (!q) {
      abortRef.current?.abort();
      abortRef.current = null;
      setOffers([]);
      setError(null);
      setLoading(false);
      setQuery(nextQ != null ? "" : query);
      return;
    }

    const minP = parsePriceInput(minPriceText);
    const maxP = parsePriceInput(maxPriceText);

    // 防呆：顛倒
    if (minP != null && maxP != null && minP > maxP) {
      setError("最低價不能大於最高價");
      return;
    }

    // 立即搜尋（按 Enter/按鈕/點熱門）：同步 query
    if (nextQ != null) setQuery(q);

    setError(null);

    // abort 上一筆
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // loading：即時搜尋時不要清空舊資料，畫面比較穩
    setLoading(true);

    try {
      const items = await searchProducts(q, { minPrice: minP, maxPrice: maxP, signal: ac.signal });
      if (ac.signal.aborted) return;

      setOffers(items);
      pushRecent(q);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setOffers([]);
      setError(e instanceof Error ? e.message : "搜尋失敗");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }

  // ✅ 即時搜尋：query/min/max 變動後 350ms 自動更新
  useEffect(() => {
    // 第一次 render 不要打（等使用者輸入）
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    const q = query.trim();
    // 沒關鍵字就不自動打 API
    if (!q) return;

    const t = window.setTimeout(() => {
      doSearch();
    }, 350);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, minPriceText, maxPriceText]);

  // 原本的 onSearch（按鈕 / Enter）→ 立即搜
  async function onSearch(nextQ?: string) {
    await doSearch({ nextQ });
  }

  function applyPreset(p: { min?: number; max?: number }) {
    setMinPriceText(p.min == null ? "" : String(p.min));
    setMaxPriceText(p.max == null ? "" : String(p.max));
    // 不用手動搜：useEffect 會因為 min/max 變動自動更新
  }

  async function submitAuth() {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const email = authEmail.trim();
      const pw = authPassword;
      const u = authMode === "login" ? await login(email, pw) : await register(email, pw);
      setUser(u);
      setAuthOpen(false);
      setAuthPassword("");
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : "操作失敗");
    } finally {
      setAuthLoading(false);
    }
  }

  async function doLogout() {
    try {
      await logout();
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
            <button
              className="btn btnPrimary"
              onClick={() => {
                setAuthOpen(true);
                setAuthMode("login");
                setAuthError(null);
              }}
            >
              登入
            </button>
          )}

          <button className="btn" onClick={() => alert("下一步接：登入後的追蹤清單 / 貼 URL 追蹤")}>
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
          <button className={`btn ${loading || !query.trim() ? "" : "btnPrimary"}`} onClick={() => onSearch()} disabled={loading || !query.trim()}>
            {loading ? "搜尋中…" : "搜尋"}
          </button>
        </div>

        {/* price range */}
        <div className="searchRow" style={{ marginTop: 10 }}>
          <input
            className="input"
            value={minPriceText}
            onChange={(e) => setMinPriceText(e.target.value)}
            inputMode="numeric"
            placeholder="最低價（例如 5000）"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
          />
          <input
            className="input"
            value={maxPriceText}
            onChange={(e) => setMaxPriceText(e.target.value)}
            inputMode="numeric"
            placeholder="最高價（例如 9000）"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
          />
        </div>

        {/* preset chips */}
        <div className="chipRow">
          {PRICE_PRESETS.map((p) => (
            <button key={p.label} className="chipBtn" onClick={() => applyPreset(p)} type="button" title="套用價格區間">
              {p.label}
            </button>
          ))}
          <span className="chipHint">（點一下快速套用）</span>
        </div>

        {/* hot keywords */}
        <div className="chipRow">
          <span className="chipLabel">熱門：</span>
          {HOT_KEYWORDS.map((k) => (
            <button key={k} className="chipBtn" onClick={() => onSearch(k)} type="button">
              {k}
            </button>
          ))}
        </div>

        {/* recent searches */}
        {recent.length > 0 && (
          <div className="chipRow">
            <span className="chipLabel">最近：</span>
            {recent.map((k) => (
              <span key={k} className="chipWrap">
                <button className="chipBtn" onClick={() => onSearch(k)} type="button">
                  {k}
                </button>
                <button className="chipX" onClick={() => removeRecent(k)} title="移除" type="button">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="chips">
          {["API 已串接", "多平台比價", user ? "已登入" : "未登入"].map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>

        {error && <div style={{ marginTop: 10, color: "crimson" }}>{error}</div>}
      </div>

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
                      navigator.clipboard?.writeText(o.url);
                    }}
                    title="複製連結"
                  >
                    複製
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="footer">提示：接下來做「登入後追蹤清單」→ 貼 URL 追蹤 → 每週趨勢 → 目標價提醒。</div>

      {/* Auth modal */}
      {authOpen && (
        <div className="modalMask" onClick={() => setAuthOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalTop">
              <div className="modalTitle">{authMode === "login" ? "登入" : "註冊"}</div>
              <button className="modalX" onClick={() => setAuthOpen(false)} type="button">
                ×
              </button>
            </div>

            <div className="modalTabs">
              <button className={`tabBtn ${authMode === "login" ? "tabActive" : ""}`} onClick={() => setAuthMode("login")} type="button">
                登入
              </button>
              <button className={`tabBtn ${authMode === "register" ? "tabActive" : ""}`} onClick={() => setAuthMode("register")} type="button">
                註冊
              </button>
            </div>

            <div className="modalBody">
              <input className="input" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" />
              <input
                className="input"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="密碼（至少 6 碼）"
                type="password"
                style={{ marginTop: 10 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAuth();
                }}
              />

              {authError && <div style={{ marginTop: 10, color: "crimson" }}>{authError}</div>}

              <button className="btn btnPrimary" style={{ width: "100%", marginTop: 12 }} onClick={submitAuth} disabled={authLoading}>
                {authLoading ? "處理中…" : authMode === "login" ? "登入" : "註冊"}
              </button>

              <div className="modalHint">目前是暫存 users（Map）；之後換 DB 只要把 auth routes 的 storage 換掉即可。</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}