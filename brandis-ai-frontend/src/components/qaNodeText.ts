import { PersistedMark, SuggestedKeyword } from '@/types/canvas';
import { darken } from '@/lib/colors';

export type ActiveMark = {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
};

type Span = {
  start: number;
  end: number;
  type: 'plain' | 'keyword' | 'persisted' | 'active';
  hex?: string;
  targetNodeId?: string;
};

export type ProseBlock =
  | { type: 'paragraph'; text: string; offset: number }
  | { type: 'list'; items: { text: string; offset: number }[] };

export type Segment =
  | { type: 'prose'; text: string; offset: number }
  | { type: 'code'; lang: string; code: string; offset: number };

const LIST_RE = /^(?:[-*]|\d+[.)]) /;

export function buildSpans(
  textLength: number,
  keywords: SuggestedKeyword[],
  persistedMarks: PersistedMark[],
  activeMarks: ActiveMark[],
  activeHex: string
): Span[] {
  const points = new Set<number>();
  points.add(0);
  points.add(textLength);

  type Region = {
    start: number;
    end: number;
    type: 'keyword' | 'persisted' | 'active';
    hex?: string;
    targetNodeId?: string;
    priority: number;
  };
  const regions: Region[] = [];

  for (const kw of keywords) {
    points.add(kw.startIndex);
    points.add(kw.endIndex);
    regions.push({ start: kw.startIndex, end: kw.endIndex, type: 'keyword', hex: kw.hex, priority: 0 });
  }
  for (const m of persistedMarks) {
    points.add(m.startIndex);
    points.add(m.endIndex);
    regions.push({
      start: m.startIndex,
      end: m.endIndex,
      type: 'persisted',
      hex: m.color,
      targetNodeId: m.targetNodeId,
      priority: 2,
    });
  }
  for (const m of activeMarks) {
    points.add(m.startIndex);
    points.add(m.endIndex);
    regions.push({ start: m.startIndex, end: m.endIndex, type: 'active', hex: activeHex, priority: 1 });
  }

  const sorted = Array.from(points).sort((a, b) => a - b);
  const spans: Span[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;

    const covering = regions
      .filter((r) => r.start <= start && r.end >= end)
      .sort((a, b) => b.priority - a.priority);

    if (covering.length > 0) {
      const top = covering[0];
      spans.push({ start, end, type: top.type, hex: top.hex, targetNodeId: top.targetNodeId });
    } else {
      spans.push({ start, end, type: 'plain' });
    }
  }

  return spans;
}

export function splitProseBlocks(text: string): ProseBlock[] {
  const lines = text.split('\n');
  const blocks: ProseBlock[] = [];
  let pos = 0;

  let currentList: { text: string; offset: number }[] | null = null;

  for (const line of lines) {
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (LIST_RE.test(trimmed)) {
      const bulletLen = trimmed.match(LIST_RE)![0].length;
      const itemText = trimmed.substring(bulletLen);
      const itemOffset = pos + indent + bulletLen;

      if (!currentList) currentList = [];
      currentList.push({ text: itemText, offset: itemOffset });
    } else {
      if (currentList) {
        blocks.push({ type: 'list', items: currentList });
        currentList = null;
      }
      if (trimmed.length > 0) {
        blocks.push({ type: 'paragraph', text: trimmed, offset: pos + indent });
      }
    }

    pos += line.length + 1;
  }

  if (currentList) {
    blocks.push({ type: 'list', items: currentList });
  }

  return blocks;
}

export function getHighlightTextShadow(hex: string): string {
  const shadowColor = darken(hex, 0.55);
  return `0 0.6px 0 ${shadowColor}40, 0 1.2px 2px ${shadowColor}30`;
}

export function parseResponseSegments(response: string): Segment[] {
  const segments: Segment[] = [];
  if (!response) return segments;

  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(response)) !== null) {
    if (match.index > lastEnd) {
      segments.push({ type: 'prose', text: response.substring(lastEnd, match.index), offset: lastEnd });
    }
    segments.push({ type: 'code', lang: match[1] || '', code: match[2].trim(), offset: match.index });
    lastEnd = match.index + match[0].length;
  }

  if (lastEnd < response.length) {
    segments.push({ type: 'prose', text: response.substring(lastEnd), offset: lastEnd });
  }

  return segments;
}
