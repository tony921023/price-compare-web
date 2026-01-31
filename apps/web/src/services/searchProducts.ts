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

export async function searchProducts(query: string, opts?: SearchOptions): Promise<Offer[]> {
  const q = query.trim();
  if (!q) return [];

  const params = new URLSearchParams();
  params.set("q", q);

  const min = opts?.minPrice;
  const max = opts?.maxPrice;

  if (typeof min === "number" && Number.isFinite(min)) params.set("minPrice", String(min));
  if (typeof max === "number" && Number.isFinite(max)) params.set("maxPrice", String(max));

  const resp = await fetch(`/api/search?${params.toString()}`);
  if (!resp.ok) throw new Error(`search failed: ${resp.status}`);

  const data = await resp.json();
  return (data?.items ?? []) as Offer[];
}