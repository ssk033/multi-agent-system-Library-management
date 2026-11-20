export function fenceUserText(text: string): string {
  return text.replaceAll("```", "'''").replaceAll("\u0000", "").slice(0, 2000);
}

export function composeFallbackAnswer(observations: string[], confirmationMessage?: string | null): string {
  const text = [...observations, confirmationMessage ?? ""].map((item) => item.trim()).filter(Boolean).join("\n\n");
  return text || "I could not find a grounded answer in the library records.";
}
