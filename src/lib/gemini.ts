import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function embeddingDimensions(): number {
  const parsed = Number.parseInt(process.env.EMBEDDING_DIMENSIONS || "768", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 768;
}

export function getChatModel(temperature = 0.2) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
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
    modelName: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
    apiKey: process.env.GEMINI_API_KEY,
  });
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
