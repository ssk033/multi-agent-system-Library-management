import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { AgentName } from "@/lib/routing";
import type { AgentTraceEvent, BookCard, ConfirmationRequest } from "@/types";

export const LibraryAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(Array.isArray(right) ? right : [right]),
    default: () => [],
  }),
  traces: Annotation<AgentTraceEvent[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  observations: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  completed: Annotation<AgentName[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  bookCards: Annotation<BookCard[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  confirmation: Annotation<ConfirmationRequest | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  next: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "supervisor",
  }),
  iteration: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  userText: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  finalText: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
});

export type LibraryState = typeof LibraryAnnotation.State;
