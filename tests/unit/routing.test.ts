import { describe, expect, it } from "vitest";
import { nextAgent, planRoute, resolveRoute } from "@/lib/routing";

describe("supervisor routing", () => {
  it("sends a topic search to discovery", () => {
    expect(planRoute("Find me three books on artificial intelligence and machine learning.")).toEqual(["discovery"]);
  });

  it("searches before borrowing when the title is described by topic", () => {
    expect(planRoute("I want to borrow a book on machine learning.")).toEqual(["discovery", "circulation"]);
  });

  it("asks acquisition to follow discovery when the user wants a purchase", () => {
    expect(planRoute("The book I want is unavailable. Can the library purchase it?")).toEqual(["discovery", "acquisition"]);
  });

  it("keeps personal loan questions with circulation", () => {
    expect(planRoute("Show me all the books I currently have issued.")).toEqual(["circulation"]);
    expect(planRoute("Which books are overdue?")).toEqual(["circulation"]);
    expect(planRoute("Return my book on database management.")).toEqual(["circulation"]);
  });

  it("moves to the next planned agent after one specialist finishes", () => {
    const plan = planRoute("I want to borrow a book on machine learning.");
    expect(nextAgent(plan, ["discovery"], 1)).toBe("circulation");
    expect(resolveRoute({
      llmChoice: "discovery",
      plan,
      completed: ["discovery"],
      iteration: 2,
      needsConfirmation: false,
    })).toBe("circulation");
  });

  it("stops for confirmation before another specialist runs", () => {
    expect(resolveRoute({
      llmChoice: "circulation",
      plan: ["discovery", "circulation"],
      completed: ["discovery", "circulation"],
      iteration: 3,
      needsConfirmation: true,
    })).toBe("confirm_gate");
  });

  it("finishes when the iteration limit is reached", () => {
    expect(resolveRoute({
      llmChoice: "discovery",
      plan: ["discovery"],
      completed: [],
      iteration: 6,
      needsConfirmation: false,
    })).toBe("FINISH");
  });
});
