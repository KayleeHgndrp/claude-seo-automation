/**
 * Defensive JSON parsing for LLM output.
 *
 * Claude is instructed to return STRICT JSON (no markdown fences, no
 * preamble), but models occasionally wrap output in ```json fences or add a
 * stray sentence. This module recovers the JSON object robustly and never
 * throws raw to the caller — it returns a discriminated result instead.
 */

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; raw: string };

/** Strip ```json ... ``` / ``` ... ``` fences if present. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence ? fence[1].trim() : trimmed;
}

/**
 * Extract the first balanced top-level JSON object or array from a string,
 * ignoring braces inside string literals. Returns null if none found.
 */
function extractFirstJson(text: string): string | null {
  const start = text.search(/[{[]/);
  if (start === -1) return null;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Parse model output into JSON defensively. Tries, in order: raw parse,
 * fence-stripped parse, first-balanced-object extraction.
 */
export function parseModelJson<T = unknown>(text: string): ParseResult<T> {
  const attempts = [text, stripFences(text)];
  const extracted = extractFirstJson(stripFences(text));
  if (extracted) attempts.push(extracted);

  for (const candidate of attempts) {
    try {
      return { ok: true, data: JSON.parse(candidate) as T };
    } catch {
      // try next strategy
    }
  }
  return {
    ok: false,
    error: "Could not parse model output as JSON.",
    raw: text.slice(0, 2000),
  };
}
