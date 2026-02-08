import { useEffect, useState } from "react";
import { getAlerts, createAlert, deleteAlert, type Alert } from "../services/alerts";

type Props = {
  watchlistId: number;
};

const PLATFORMS = [
  { value: "pchome", label: "PChome" },
  { value: "shopee", label: "Shopee" },
  { value: "momo", label: "momo" },
];

export default function AlertPanel({ watchlistId }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState("pchome");
  const [targetPrice, setTargetPrice] = useState("");

  async function load() {
    setLoading(true);
    try {
      const list = await getAlerts(watchlistId);
      setAlerts(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [watchlistId]);

  async function handleCreate() {
    const price = Number(targetPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("請輸入有效的目標價");
      return;
    }
    setError(null);
    try {
      const alert = await createAlert(watchlistId, platform, price);
      setAlerts((prev) => {
        const filtered = prev.filter((a) => a.platform !== alert.platform);
        return [alert, ...filtered];
      });
      setTargetPrice("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "建立失敗");
    }
  }

  async function handleDelete(alertId: number) {
    try {
      await deleteAlert(watchlistId, alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "刪除失敗");
    }
  }

  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 12, border: "1px solid rgba(20,30,60,0.1)", background: "rgba(255,255,255,0.5)" }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>目標價提醒</div>

      {error && <div style={{ color: "crimson", fontSize: 12, marginBottom: 6 }}>{error}</div>}

      {/* Form */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          style={{ padding: "6px 8px", borderRadius: 10, border: "1px solid rgba(20,30,60,0.15)", background: "#fff", fontSize: 13 }}
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <input
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          placeholder="目標價"
          inputMode="numeric"
          style={{ width: 100, padding: "6px 8px", borderRadius: 10, border: "1px solid rgba(20,30,60,0.15)", fontSize: 13 }}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
        />
        <button className="ghostBtn" onClick={handleCreate} style={{ fontSize: 12 }}>建立</button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ fontSize: 12, opacity: 0.6 }}>載入中…</div>
      ) : alerts.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.6 }}>尚無提醒</div>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          {alerts.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(20,30,60,0.06)",
                fontSize: 12,
              }}
            >
              <span>
                <strong>{a.platform === "pchome" ? "PChome" : a.platform === "shopee" ? "Shopee" : "momo"}</strong>
                {" "}
                &le; ${a.target_price.toLocaleString()}
                {a.last_triggered && (
                  <span style={{ marginLeft: 6, color: "rgba(15,125,102,0.8)" }}>
                    已觸發 {new Date(a.last_triggered).toLocaleDateString("zh-TW")}
                  </span>
                )}
              </span>
              <button
                className="ghostBtn"
                onClick={() => handleDelete(a.id)}
                style={{ fontSize: 11, padding: "4px 8px" }}
              >
                刪除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
