import { useEffect, useMemo, useState } from "react";
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

export default function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [minPriceText, setMinPriceText] = useState("");
  const [maxPriceText, setMaxPriceText] = useState("");

  const [offers, setOffers] = useState<Offer[]>([]);

  // ✅ auth states
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 開頁先問一次 me()
  useEffect(() => {
    me()
      .then((u) => setUser(u))
      .catch(() => setUser(null));
  }, []);

  const sorted = useMemo(() => {
    const copy = [...offers];
    copy.sort((a, b) => a.price - b.price);
    return copy;
  }, [offers]);

  const minPrice = useMemo(() => {
    const prices = sorted.map((o) => o.price).filter((p) => typeof p === "number" && Number.isFinite(p));
    return prices.length ? Math.min(...prices) : null;
  }, [sorted]);

  async function onSearch() {
    const q = query.trim();
    if (!q) return;

    const minP = parsePriceInput(minPriceText);
    const maxP = parsePriceInput(maxPriceText);

    if (minP != null && maxP != null && minP > maxP) {
      setError("最低價不能大於最高價");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const items = await searchProducts(q, { minPrice: minP, maxPrice: maxP });
      setOffers(items);
    } catch (e: any) {
      setOffers([]);
      setError(e?.message ?? "搜尋失敗");
    } finally {
      setLoading(false);
    }
  }

  async function onAuthSubmit() {
    const em = email.trim().toLowerCase();
    if (!em || !password) {
      setError("請輸入 email / password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const u = authMode === "login" ? await login(em, password) : await register(em, password);
      setUser(u);
      setAuthOpen(false);
      setPassword("");
    } catch (e: any) {
      setError(e?.message ?? "登入/註冊失敗");
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    setLoading(true);
    setError(null);
    try {
      await logout();
      setUser(null);
    } catch (e: any) {
      setError(e?.message ?? "登出失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
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
              <span className="pill" title={user.email}>{user.email}</span>
              <button className="btn" onClick={onLogout} disabled={loading}>
                登出
              </button>
            </>
          ) : (
            <button
              className="btn btnPrimary"
              onClick={() => {
                setAuthMode("login");
                setAuthOpen(true);
              }}
            >
              登入
            </button>
          )}

          <button className="btn" onClick={() => alert("先做 UI，下一步接登入/追蹤清單")}>
            追蹤清單
          </button>
        </div>
      </div>

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

        <div className="chips">
          {["API 已串接", "多平台比價", user ? "已登入" : "未登入"].map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>

        {error && <div style={{ marginTop: 10, color: "crimson" }}>{error}</div>}
      </div>

      <div className="glass cardHover" style={{ marginTop: 16 }}>
        <div className="tableHeader">
          <div>平台</div>
          <div>商品</div>
          <div>價格</div>
          <div>操作</div>
        </div>

        {sorted.length === 0 && !loading ? (
          <div style={{ padding: 16, opacity: 0.7 }}>尚無結果：輸入關鍵字後按「搜尋」</div>
        ) : (
          sorted.map((o, idx) => {
            const badge = (o as any).badge as string | undefined;
            const isBest = badge ? badge === "最低" : minPrice != null && o.price === minPrice;

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

                <div>
                  <a className="linkBtn" href={o.url} target="_blank" rel="noreferrer">
                    前往
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="footer">提示：接下來我們做「貼 URL 追蹤」→ 每週價格趨勢 → 目標價提醒。</div>

      {/* ✅ 超簡單 Auth Modal（不動你 CSS 結構，先能用） */}
      {authOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setAuthOpen(false)}
        >
          <div
            className="glass"
            style={{ width: 420, padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{authMode === "login" ? "登入" : "註冊"}</h3>
              <button className="btn" onClick={() => setAuthOpen(false)}>
                關閉
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <input
                className="input"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <input
                className="input"
                placeholder="Password（至少 6 碼）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onAuthSubmit();
                }}
              />
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button className="btn btnPrimary" onClick={onAuthSubmit} disabled={loading}>
                {loading ? "處理中…" : authMode === "login" ? "登入" : "註冊"}
              </button>

              <button
                className="btn"
                onClick={() => setAuthMode((m) => (m === "login" ? "register" : "login"))}
                disabled={loading}
              >
                切換到{authMode === "login" ? "註冊" : "登入"}
              </button>
            </div>

            {error && <div style={{ marginTop: 10, color: "crimson" }}>{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}