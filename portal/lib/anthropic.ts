/**
 * Anthropic client + a small helper to run a single-turn message and return
 * the concatenated text. Skills/agents never run in the app runtime — we use
 * the SEO methodology as a system prompt here (see lib/prompts/*).
 */

import Anthropic from "@anthropic-ai/sdk";
import { requireEnv, ANTHROPIC_MODEL } from "./env";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  }
  return client;
}

export interface CompleteOptions {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

/** Run one message turn and return the text content. */
export async function complete({
  system,
  user,
  maxTokens = 3000,
  temperature = 0.2,
}: CompleteOptions): Promise<string> {
  const resp = await getClient().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: user }],
  });

  return resp.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
