
import { GoogleGenerativeAI } from "@google/generative-ai";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export class RateLimitError extends Error {
  constructor(provider: string) {
    super(
      `AI service rate limit reached (${provider}). Please wait a few minutes and try again.`
    );
    this.name = "RateLimitError";
  }
}

export class AllProvidersExhaustedError extends Error {
  constructor() {
    super(
      "All AI services are temporarily unavailable due to rate limits. Please try again in a few minutes."
    );
    this.name = "AllProvidersExhaustedError";
  }
}

/**
 * Call Groq's OpenAI-compatible API.
 * Returns the assistant's response text or throws.
 */
async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (response.status === 429) {
    throw new RateLimitError("Groq");
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * Call Google Gemini API.
 * Returns the response text or throws.
 */
async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("429")) {
      throw new RateLimitError("Gemini");
    }
    throw err;
  }
}

/**
 * Call LLM with automatic fallback: Groq first, then Gemini.
 * Throws AllProvidersExhaustedError if both are rate-limited.
 */
export async function callLLM(prompt: string): Promise<string> {
  // Try Groq first
  try {
    return await callGroq(prompt);
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn("Groq rate limited, falling back to Gemini...");
    } else if (err instanceof Error && err.message.includes("not configured")) {
      console.warn("Groq not configured, falling back to Gemini...");
    } else {
      console.error("Groq error:", err);
    }
  }

  // Fall back to Gemini
  try {
    return await callGemini(prompt);
  } catch (err) {
    if (err instanceof RateLimitError) {
      throw new AllProvidersExhaustedError();
    }
    throw err;
  }
}
