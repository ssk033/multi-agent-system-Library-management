import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function embeddingDimensions(): number {
  const parsed = Number.parseInt(process.env.EMBEDDING_DIMENSIONS || "768", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 768;
}

function chatModelName() {
  const configured = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  if (configured === "gemini-2.5-flash" || configured === "gemini-2.0-flash") return "gemini-3.5-flash";
  return configured;
}

export function getChatModel(temperature = 0.2) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new ChatGoogleGenerativeAI({
    model: chatModelName(),
    apiKey: process.env.GEMINI_API_KEY,
    temperature,
    maxOutputTokens: 2048,
  });
}

export function getEmbeddings() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenerativeAIEmbeddings({
    modelName: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
    apiKey: process.env.GEMINI_API_KEY,
  });
}

export async function embedWithGemini(texts: string[]): Promise<number[][]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const model = (process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001").replace(/^models\//, "");
  const dimensions = embeddingDimensions();
  const vectors: number[][] = [];
  for (const text of texts) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: dimensions,
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    const body = (await response.json()) as {
      embedding?: { values?: number[] };
      error?: { message?: string };
    };
    if (!response.ok || !body.embedding?.values) {
      throw new Error(body.error?.message || `Embedding request failed (${response.status})`);
    }
    vectors.push(body.embedding.values);
  }
  return vectors;
}

export function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part === "object" && part && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("");
  }
  return "";
}
