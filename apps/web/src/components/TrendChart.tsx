import type { HistoryPoint } from "../services/watchlist";

type Props = {
  history: HistoryPoint[];
};

const PLATFORM_COLORS: Record<string, string> = {
  pchome: "#3b82f6",
  shopee: "#f97316",
  momo: "#ef4444",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatPrice(n: number) {
  return `$${n.toLocaleString()}`;
}

export default function TrendChart({ history }: Props) {
  if (!history.length) return null;

  const platforms = [...new Set(history.map((h) => h.platform))];
  const prices = history.map((h) => h.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const pRange = maxP - minP || 1;

  const W = 520;
  const H = 220;
  const PAD = { top: 20, right: 20, bottom: 30, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const dates = [...new Set(history.map((h) => h.collected_at))].sort();
  const dateIdxMap = new Map(dates.map((d, i) => [d, i]));
  const xStep = dates.length > 1 ? plotW / (dates.length - 1) : plotW;

  function toX(idx: number) {
    return PAD.left + (dates.length > 1 ? idx * xStep : plotW / 2);
  }
  function toY(price: number) {
    return PAD.top + plotH - ((price - minP) / pRange) * plotH;
  }

  // Y-axis ticks (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => minP + (pRange * i) / 4);

  // X-axis labels (max 6)
  const xLabelStep = Math.max(1, Math.floor(dates.length / 6));
  const xLabels = dates.filter((_, i) => i % xLabelStep === 0 || i === dates.length - 1);

  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ maxWidth: "100%", height: "auto" }}>
        {/* Grid lines */}
        {yTicks.map((t) => (
          <line
            key={t}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={toY(t)}
            y2={toY(t)}
            stroke="rgba(0,0,0,0.08)"
            strokeDasharray="4 2"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((t) => (
          <text key={`yl-${t}`} x={PAD.left - 6} y={toY(t) + 4} textAnchor="end" fontSize={10} fill="#666">
            {formatPrice(Math.round(t))}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((d) => {
          const idx = dateIdxMap.get(d)!;
          return (
            <text key={`xl-${d}`} x={toX(idx)} y={H - 6} textAnchor="middle" fontSize={10} fill="#666">
              {formatDate(d)}
            </text>
          );
        })}

        {/* Lines per platform */}
        {platforms.map((p) => {
          const pts = history
            .filter((h) => h.platform === p)
            .map((h) => ({ x: toX(dateIdxMap.get(h.collected_at)!), y: toY(h.price) }));
          if (pts.length < 2) {
            return pts.map((pt, i) => (
              <circle key={`${p}-dot-${i}`} cx={pt.x} cy={pt.y} r={4} fill={PLATFORM_COLORS[p] || "#888"} />
            ));
          }
          const points = pts.map((pt) => `${pt.x},${pt.y}`).join(" ");
          return (
            <g key={p}>
              <polyline
                points={points}
                fill="none"
                stroke={PLATFORM_COLORS[p] || "#888"}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {pts.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={3} fill={PLATFORM_COLORS[p] || "#888"} />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 12 }}>
        {platforms.map((p) => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 3,
                borderRadius: 2,
                background: PLATFORM_COLORS[p] || "#888",
              }}
            />
            {p === "pchome" ? "PChome" : p === "shopee" ? "Shopee" : "momo"}
          </div>
        ))}
      </div>
    </div>
  );
}
