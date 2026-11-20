import type { AgentName, AgentTraceEvent } from "@/types";

export function makeTrace(
  agent: AgentTraceEvent["agent"],
  type: AgentTraceEvent["type"],
  message: string,
  extra?: Partial<AgentTraceEvent>,
): AgentTraceEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    agent,
    type,
    message,
    ...extra,
  };
}

export const AGENT_LABEL: Record<AgentName, string> = {
  supervisor: "Supervisor",
  discovery: "Discovery Agent",
  circulation: "Circulation Agent",
  acquisition: "Acquisition Agent",
};
