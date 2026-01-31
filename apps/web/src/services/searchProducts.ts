// apps/web/src/services/searchProducts.ts

export type Platform = "momo" | "pchome" | "shopee";

export type Offer = {
  platform: Platform;
  title: string;
  price: number;
  url: string;
  updatedAt: string;
};

export async function searchProducts(query: string): Promise<Offer[]> {
  const q = query.trim();
  if (!q) return [];

  const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  if (!resp.ok) throw new Error(`search failed: ${resp.status}`);

  const data = await resp.json();
  // 假設後端回：{ items: Offer[] }
  return (data?.items ?? []) as Offer[];
}