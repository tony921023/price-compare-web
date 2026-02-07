import { useEffect, useRef, useState } from "react";
import { searchProducts, type Offer } from "../services/searchProducts";

function parsePriceInput(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const HOT_KEYWORDS = ["AirPods Pro 2", "iPhone 15", "SSD 1TB", "龄絃", "φ诀", "籌"];
const PRICE_PRESETS: Array<{ label: string; min?: number; max?: number }> = [
  { label: "ぃ" },
  { label: "1k~3k", min: 1000, max: 3000 },
  { label: "3k~6k", min: 3000, max: 6000 },
  { label: "6k~9k", min: 6000, max: 9000 },
];

type Props = {
  loggedIn: boolean;
  onResults: (items: Offer[]) => void;
  onLoading: (v: boolean) => void;
  onError: (msg: string | null) => void;
  error: string | null;
};

export default function SearchCard({ loggedIn, onResults, onLoading, onError, error }: Props) {
  const [query, setQuery] = useState("");
  const [minPriceText, setMinPriceText] = useState("");
  const [maxPriceText, setMaxPriceText] = useState("");
  const [loading, setLoading] = useState(false);

  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("pp_recent");
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return Array.isArray(arr) ? arr.slice(0, 6) : [];
    } catch {
      return [];
    }
  });

  const abortRef = useRef<AbortController | null>(null);
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

  async function doSearch(opts?: { nextQ?: string }) {
    const nextQ = opts?.nextQ;
    const q = (nextQ ?? query).trim();

    if (!q) {
      abortRef.current?.abort();
      abortRef.current = null;
      onResults([]);
      onError(null);
      setLoading(false);
      onLoading(false);
      setQuery(nextQ != null ? "" : query);
      return;
    }

    const minP = parsePriceInput(minPriceText);
    const maxP = parsePriceInput(maxPriceText);

    if (minP != null && maxP != null && minP > maxP) {
      onError("程基ぃ蔼程蔼基");
      return;
    }

    if (nextQ != null) setQuery(q);
    onError(null);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    onLoading(true);

    try {
      const items = await searchProducts(q, { minPrice: minP, maxPrice: maxP, signal: ac.signal });
      if (ac.signal.aborted) return;
      onResults(items);
      pushRecent(q);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      onResults([]);
      onError(e instanceof Error ? e.message : "祇ネ岿粇");
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false);
        onLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const q = query.trim();
    if (!q) return;

    const t = window.setTimeout(() => {
      doSearch();
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, minPriceText, maxPriceText]);

  async function onSearch(nextQ?: string) {
    await doSearch({ nextQ });
  }

  function applyPreset(p: { min?: number; max?: number }) {
    setMinPriceText(p.min == null ? "" : String(p.min));
    setMaxPriceText(p.max == null ? "" : String(p.max));
  }

  return (
    <div className="glass glassStrong cardHover searchCard">
      <div className="searchRow">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ㄒAirPods Pro 2 / iPhone 15 / SSD 1TB"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
        />
        <button
          className={`btn ${loading || !query.trim() ? "" : "btnPrimary"}`}
          onClick={() => onSearch()}
          disabled={loading || !query.trim()}
        >
          {loading ? "穓碝い" : "穓碝"}
        </button>
      </div>

      <div className="searchRow" style={{ marginTop: 10 }}>
        <input
          className="input"
          value={minPriceText}
          onChange={(e) => setMinPriceText(e.target.value)}
          inputMode="numeric"
          placeholder="程基ㄒ 5000"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
        />
        <input
          className="input"
          value={maxPriceText}
          onChange={(e) => setMaxPriceText(e.target.value)}
          inputMode="numeric"
          placeholder="程蔼基ㄒ 9000"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
        />
      </div>

      <div className="chipRow">
        {PRICE_PRESETS.map((p) => (
          <button key={p.label} className="chipBtn" onClick={() => applyPreset(p)} type="button" title="е硉甅ノ基跋丁">
            {p.label}
          </button>
        ))}
        <span className="chipHint">翴е硉甅ノ</span>
      </div>

      <div className="chipRow">
        <span className="chipLabel">荐</span>
        {HOT_KEYWORDS.map((k) => (
          <button key={k} className="chipBtn" onClick={() => onSearch(k)} type="button">
            {k}
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <div className="chipRow">
          <span className="chipLabel">程</span>
          {recent.map((k) => (
            <span key={k} className="chipWrap">
              <button className="chipBtn" onClick={() => onSearch(k)} type="button">
                {k}
              </button>
              <button className="chipX" onClick={() => removeRecent(k)} title="簿埃" type="button">
                ⊙
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="chips">
        {["API ﹃钡", "キゑ基", loggedIn ? "祅" : "ゼ祅"].map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
      </div>

      {error && <div style={{ marginTop: 10, color: "crimson" }}>{error}</div>}
    </div>
  );
}