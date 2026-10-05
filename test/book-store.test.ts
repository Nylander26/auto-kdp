import { describe, it, expect } from "vitest";
import { currentPageBySlot, pageId } from "../src/lib/book-store.js";
import type { PageMeta } from "../src/lib/types.js";

const page = (index: number, status: PageMeta["status"], regenerationCount = 0): PageMeta => ({
  id: pageId(index, regenerationCount),
  bookId: "b",
  index,
  subject: "s",
  prompt: "p",
  status,
  createdAt: "",
  files: { raw: "", print: "" },
  regenerationCount,
});

describe("book-store", () => {
  it("formats page ids", () => {
    expect(pageId(3)).toBe("p03");
    expect(pageId(12, 2)).toBe("p12-r2");
  });

  it("picks the approved attempt per slot, else the newest", () => {
    const slots = currentPageBySlot([
      page(1, "rejected"),
      page(1, "approved", 1),
      page(1, "rejected", 2),
      page(2, "rejected"),
      page(2, "pending-review", 1),
    ]);
    expect(slots.get(1)?.id).toBe("p01-r1");
    expect(slots.get(2)?.id).toBe("p02-r1");
  });
});
