import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchProducts } from "./searchProducts";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("searchProducts", () => {
  it("returns empty array for blank query without calling fetch", async () => {
    const result = await searchProducts("   ");
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns items on successful response", async () => {
    const items = [
      { platform: "pchome", title: "test", price: 100, url: "https://example.com", updatedAt: "2025-01-01", badge: "最低" },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items }),
    });

    const result = await searchProducts("keyboard");
    expect(result).toEqual(items);
    expect(mockFetch).toHaveBeenCalledOnce();

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("q=keyboard");
  });

  it("passes minPrice and maxPrice as query params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    });

    await searchProducts("mouse", { minPrice: 500, maxPrice: 2000 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("minPrice=500");
    expect(url).toContain("maxPrice=2000");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(searchProducts("fail")).rejects.toThrow("search failed: 500");
  });
});
