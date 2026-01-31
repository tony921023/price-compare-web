// apps/web/src/services/searchProducts.ts

export type Platform = "momo" | "pchome" | "shopee";

export type Offer = {
  platform: Platform;
  title: string;
  price: number;
  url: string;
  updatedAt: string;
  badge?: string;
};

export type SearchOptions = {
  minPrice?: number | null;
  maxPrice?: number | null;
};

async function json<T>(resp: Response): Promise<T> {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((data as any)?.message || `HTTP ${resp.status}`);
  return data as T;
}

export async function searchProducts(query: string, opts: SearchOptions = {}): Promise<Offer[]> {
  const q = query.trim();
  if (!q) return [];

  const params = new URLSearchParams();
  params.set("q", q);

  if (typeof opts.minPrice === "number") params.set("minPrice", String(opts.minPrice));
  if (typeof opts.maxPrice === "number") params.set("maxPrice", String(opts.maxPrice));

  const resp = await fetch(`/api/search?${params.toString()}`);
  const data = await json<{ items: Offer[] }>(resp);
  return data.items ?? [];
}