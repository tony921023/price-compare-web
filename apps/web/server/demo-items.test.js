import { describe, it, expect } from "vitest";
import { buildDemoItems } from "./demo-items.js";

describe("buildDemoItems", () => {
  it("returns exactly 3 items (pchome, shopee, momo)", () => {
    const items = buildDemoItems("test", null, null);
    expect(items).toHaveLength(3);

    const platforms = items.map((i) => i.platform);
    expect(platforms).toEqual(["pchome", "shopee", "momo"]);
  });

  it("prices fall within specified min/max range", () => {
    const items = buildDemoItems("keyboard", 1000, 5000);
    for (const item of items) {
      expect(item.price).toBeGreaterThanOrEqual(1000);
      expect(item.price).toBeLessThanOrEqual(5000);
    }
  });

  it("exactly one item has badge '最低', the rest have '可買'", () => {
    const items = buildDemoItems("mouse", 500, 3000);
    const lowest = items.filter((i) => i.badge === "最低");
    const others = items.filter((i) => i.badge === "可買");

    expect(lowest.length).toBeGreaterThanOrEqual(1);
    expect(lowest.length + others.length).toBe(3);

    const minPrice = Math.min(...items.map((i) => i.price));
    for (const item of lowest) {
      expect(item.price).toBe(minPrice);
    }
  });

  it("uses default range (200-9000) when min/max are null", () => {
    const items = buildDemoItems("SSD", null, null);
    for (const item of items) {
      expect(item.price).toBeGreaterThanOrEqual(200);
      expect(item.price).toBeLessThanOrEqual(9000);
    }
  });

  it("is deterministic — same query returns same prices", () => {
    const a = buildDemoItems("AirPods", 1000, 8000);
    const b = buildDemoItems("AirPods", 1000, 8000);
    expect(a.map((i) => i.price)).toEqual(b.map((i) => i.price));
  });
});
