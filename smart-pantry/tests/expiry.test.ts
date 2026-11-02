import { describe, expect, it } from "vitest";
import { effectiveExpiry, expiryAdvice, groupByUrgency, urgencyOf } from "@/lib/domain/expiry";
import { item } from "./helpers";

const today = "2026-11-02";
describe("expiry", () => {
  it("buckets by days left", () => {
    expect(urgencyOf(item({ expiry_date: "2026-11-01" }), today)).toBe("expired");
    expect(urgencyOf(item({ expiry_date: "2026-11-02" }), today)).toBe("today");
    expect(urgencyOf(item({ expiry_date: "2026-11-04" }), today)).toBe("within2");
    expect(urgencyOf(item({ expiry_date: "2026-11-07" }), today)).toBe("within5");
    expect(urgencyOf(item({ expiry_date: "2026-11-09" }), today)).toBe("within7");
    expect(urgencyOf(item({ expiry_date: "2026-12-01" }), today)).toBe("fresh");
    expect(urgencyOf(item({}), today)).toBe("unknown");
  });
  it("opened products expire earlier than the printed date", () => {
    const milk = item({ expiry_date: "2026-11-20", opened_at: "2026-11-01", days_after_opening: 4 });
    expect(effectiveExpiry(milk)).toBe("2026-11-05");
    expect(urgencyOf(milk, today)).toBe("within5");
  });
  it("handles month boundaries", () => {
    expect(urgencyOf(item({ expiry_date: "2026-12-01" }), "2026-11-30")).toBe("within2");
  });
  it("distinguishes use-by from best-before and never claims safety", () => {
    expect(expiryAdvice("use_by", -1)).toMatch(/Niet meer opeten/);
    expect(expiryAdvice("best_before", -1)).toMatch(/Kwaliteit kan minder zijn/);
    expect(expiryAdvice("use_by", 3)).toMatch(/geen veiligheidsgarantie/);
  });
  it("ignores consumed items when grouping", () => {
    const g = groupByUrgency([item({ expiry_date: today, status: "consumed" }), item({ expiry_date: today })], today);
    expect(g.today).toHaveLength(1);
  });
});
