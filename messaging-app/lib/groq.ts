const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function createGroqChatCompletion(messages: GroqMessage[]) {
  const apiKey = String(process.env.GROQ_API_KEY || "").trim();
  const model = String(process.env.GROQ_MODEL || "").trim();

  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");
  if (!model) throw new Error("GROQ_MODEL is not configured.");

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Groq returned an empty response.");
  return content.trim();
}
