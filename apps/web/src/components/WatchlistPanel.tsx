import { useEffect, useState } from "react";
import { getWatchlist, removeFromWatchlist, collectSnapshot, getHistory, type WatchlistItem, type HistoryPoint } from "../services/watchlist";
import TrendChart from "./TrendChart";
import AlertPanel from "./AlertPanel";

type Props = {
  onClose: () => void;
  onSearch: (query: string, min: number | null, max: number | null) => void;
};

function formatPrice(n: number | null) {
  if (n == null) return "-";
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(n);
}

export default function WatchlistPanel({ onClose, onSearch }: Props) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotMsg, setSnapshotMsg] = useState<Record<number, string>>({});
  const [trendId, setTrendId] = useState<number | null>(null);
  const [trendHistory, setTrendHistory] = useState<HistoryPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [alertId, setAlertId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await getWatchlist();
      setItems(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleRemove(id: number) {
    try {
      await removeFromWatchlist(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (trendId === id) { setTrendId(null); setTrendHistory([]); }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "移除失敗");
    }
  }

  async function handleSnapshot(id: number) {
    setSnapshotMsg((prev) => ({ ...prev, [id]: "收集中…" }));
    try {
      const { count } = await collectSnapshot(id);
      setSnapshotMsg((prev) => ({ ...prev, [id]: `已收集 ${count} 筆` }));
      setTimeout(() => setSnapshotMsg((prev) => { const next = { ...prev }; delete next[id]; return next; }), 2000);
    } catch (e: unknown) {
      setSnapshotMsg((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "收集失敗" }));
      setTimeout(() => setSnapshotMsg((prev) => { const next = { ...prev }; delete next[id]; return next; }), 2000);
    }
  }

  async function handleTrend(id: number) {
    if (trendId === id) { setTrendId(null); setTrendHistory([]); return; }
    setTrendId(id);
    setTrendLoading(true);
    try {
      const { history } = await getHistory(id);
      setTrendHistory(history);
    } catch {
      setTrendHistory([]);
    } finally {
      setTrendLoading(false);
    }
  }

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel glass glassStrong">
        <div className="panelHead">
          <h2 style={{ margin: 0, fontSize: 18 }}>追蹤清單</h2>
          <button className="btn" onClick={onClose}>關閉</button>
        </div>

        {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>載入中…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", opacity: 0.7 }}>尚未追蹤任何商品</div>
        ) : (
          <div className="wlList">
            {items.map((item) => (
              <div key={item.id} className="wlItem" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div className="wlInfo">
                    <div style={{ fontWeight: 700 }}>{item.query}</div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>
                      {formatPrice(item.min_price)} ~ {formatPrice(item.max_price)}
                      {" · "}
                      {new Date(item.created_at).toLocaleDateString("zh-TW")}
                    </div>
                  </div>
                  <div className="wlActions">
                    <button
                      className="btn"
                      onClick={() => {
                        onSearch(item.query, item.min_price, item.max_price);
                        onClose();
                      }}
                    >
                      搜尋
                    </button>
                    <button className="ghostBtn" onClick={() => handleSnapshot(item.id)}>
                      {snapshotMsg[item.id] || "收集快照"}
                    </button>
                    <button className="ghostBtn" onClick={() => handleTrend(item.id)}>
                      {trendId === item.id ? "收起趨勢" : "查看趨勢"}
                    </button>
                    <button className="ghostBtn" onClick={() => setAlertId(alertId === item.id ? null : item.id)}>
                      {alertId === item.id ? "收起提醒" : "設定提醒"}
                    </button>
                    <button className="ghostBtn" onClick={() => handleRemove(item.id)}>移除</button>
                  </div>
                </div>

                {alertId === item.id && <AlertPanel watchlistId={item.id} />}

                {trendId === item.id && (
                  <div style={{ marginTop: 8 }}>
                    {trendLoading ? (
                      <div style={{ textAlign: "center", opacity: 0.6, padding: 12 }}>載入中…</div>
                    ) : trendHistory.length === 0 ? (
                      <div style={{ textAlign: "center", opacity: 0.6, padding: 12, fontSize: 13 }}>
                        尚無快照資料，請先收集快照
                      </div>
                    ) : (
                      <TrendChart history={trendHistory} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
