import { describe, expect, it } from "vitest";
import { takeCopy } from "@/lib/library-rules";

async function withRowLock<T>(state: { chain: Promise<void> }, work: () => Promise<T>): Promise<T> {
  const previous = state.chain;
  let release: () => void = () => undefined;
  state.chain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await work();
  } finally {
    release();
  }
}

describe("last-copy issuance", () => {
  it("lets only one of several concurrent requests take the final copy", async () => {
    const inventory = { copies: 1 };
    const lock = { chain: Promise.resolve() };
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        withRowLock(lock, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          const claimed = takeCopy(inventory.copies);
          if (!claimed.ok) return false;
          inventory.copies = claimed.availableCopies;
          return true;
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(inventory.copies).toBe(0);
  });
});
