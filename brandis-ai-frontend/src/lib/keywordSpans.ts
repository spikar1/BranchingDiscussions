/** Resolve LLM‑picked keyword strings to substring ranges in `response` (case-insensitive, whitespace-tolerant between words). */

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchKeywordSpan(
  response: string,
  termRaw: string
): { term: string; startIndex: number; endIndex: number } | null {
  const trimmed = termRaw.trim();
  if (!trimmed) return null;

  const lowerR = response.toLowerCase();
  const lowerT = trimmed.toLowerCase();
  let idx = lowerR.indexOf(lowerT);
  if (idx !== -1) {
    return {
      term: response.slice(idx, idx + trimmed.length),
      startIndex: idx,
      endIndex: idx + trimmed.length,
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  try {
    const body = words.map(escapeRegExp).join('\\s+');
    const re = new RegExp(body, 'i');
    const m = re.exec(response);
    if (!m || m.index === undefined) return null;
    return {
      term: m[0],
      startIndex: m.index,
      endIndex: m.index + m[0].length,
    };
  } catch {
    return null;
  }
}
