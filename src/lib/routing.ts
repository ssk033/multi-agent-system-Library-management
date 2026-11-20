export type AgentName = "discovery" | "circulation" | "acquisition";
export type RouteTarget = AgentName | "confirm_gate" | "FINISH";

const MAX_ITERATIONS = 6;

function unique(plan: AgentName[]): AgentName[] {
  const seen = new Set<AgentName>();
  return plan.filter((agent) => {
    if (seen.has(agent)) return false;
    seen.add(agent);
    return true;
  });
}

export function planRoute(message: string): AgentName[] {
  const q = message.toLowerCase();
  const borrow = /\b(borrow|issue|lend|check out|take out)\b/.test(q);
  const returning = /\b(return|give back)\b/.test(q);
  const renew = /\brenew/.test(q);
  const acquire =
    /\b(purchase|buy|acquire|acquisition|order)\b/.test(q) ||
    /out of stock|unavailable/.test(q);
  const personal =
    /\b(my loans|my books|my fines|overdue)\b/.test(q) ||
    /books i currently|currently have issued|i have issued|have borrowed/.test(q);

  if ((returning || renew) && !acquire) return ["circulation"];
  if (personal && !borrow && !acquire) return ["circulation"];

  const plan: AgentName[] = [];
  const wantsSearch =
    /\b(find|search|recommend|suggest|similar|learn|about|available|policy|fine|rule)\b/.test(q) ||
    borrow ||
    acquire ||
    plan.length === 0;

  if (wantsSearch) plan.push("discovery");
  if (borrow) plan.push("circulation");
  if (acquire) plan.push("acquisition");
  if (plan.length === 0) plan.push("discovery");
  return unique(plan);
}

export function nextAgent(plan: AgentName[], completed: AgentName[], iteration: number): AgentName | "FINISH" {
  if (iteration >= MAX_ITERATIONS) return "FINISH";
  return plan.find((agent) => !completed.includes(agent)) ?? "FINISH";
}

export function resolveRoute(input: {
  llmChoice: AgentName | "FINISH" | null;
  plan: AgentName[];
  completed: AgentName[];
  iteration: number;
  needsConfirmation: boolean;
}): RouteTarget {
  if (input.needsConfirmation) return "confirm_gate";
  if (input.iteration >= MAX_ITERATIONS) return "FINISH";

  const fallback = nextAgent(input.plan, input.completed, input.iteration);
  const choice = input.llmChoice ?? fallback;
  if (choice === "FINISH") return "FINISH";
  if (input.completed.at(-1) === choice) return fallback;
  return choice;
}

export const ROUTING_LIMIT = MAX_ITERATIONS;
