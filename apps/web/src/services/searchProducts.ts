// apps/web/src/services/searchProducts.ts

export type Platform = "momo" | "pchome" | "shopee";

export type Offer = {
  platform: Platform;
  title: string;
  price: number;
  url: string;
  updatedAt: string;
  badge?: string; // 後端回 "最低" / "可買"
};

export type SearchOptions = {
  minPrice?: number | null;
  maxPrice?: number | null;
  signal?: AbortSignal;
};

export async function searchProducts(query: string, opts: SearchOptions = {}): Promise<Offer[]> {
  const q = query.trim();
  if (!q) return [];

  const sp = new URLSearchParams();
  sp.set("q", q);

  if (typeof opts.minPrice === "number") sp.set("minPrice", String(opts.minPrice));
  if (typeof opts.maxPrice === "number") sp.set("maxPrice", String(opts.maxPrice));

  const resp = await fetch(`/api/search?${sp.toString()}`, {
    signal: opts.signal,
  });

  if (!resp.ok) throw new Error(`search failed: ${resp.status}`);

  const data = await resp.json();
  return (data?.items ?? []) as Offer[];
}