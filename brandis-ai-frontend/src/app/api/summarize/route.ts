import { NextResponse } from 'next/server';

import { openaiFromRequest } from '@/app/api/_lib/openaiFromRequest';
import { sanitizeHex } from '@/lib/colors';
import { matchKeywordSpan } from '@/lib/keywordSpans';

const RESPONSE_MODEL = 'gpt-4o-mini';
const KEYWORD_MODEL = 'gpt-4o-mini';
const FOLLOWUP_MODEL = 'gpt-4o-mini';

export const dynamic = 'force-dynamic';

type SummarizeRequest = {
  sources: { id: string; label: string; text: string }[];
};

function parseFollowUpQuestions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q): q is string => typeof q === 'string')
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .slice(0, 3);
  } catch {
    return [];
  }
}

const SYSTEM_SUMMARIZE =
  'You write a compact REFERENCE OVERVIEW for someone who already has these topics on their research canvas. ' +
  'They need a quick reminder of what each node/thread is about—a mental index card—not a re-teaching or full rewrite of the source text.\n\n' +
  'Be short and descriptive: name the thread, anchor it with a few memorable terms, and only add nuance when needed to tell two sources apart. ' +
  'Do not reproduce long explanations, numbered walkthroughs, large quotes, or every fact from the excerpts. ' +
  'Prefer markdown bullets when there are several distinct threads; otherwise a few crisp sentences are fine. ' +
  'If sources overlap, merge them in one line. If they disagree, note that in a half-line. ' +
  'Let total length scale gently with how many sources there are and how tangled the ideas are—but stay concise: think sticky-note before essay. ' +
  'Ground every line in the excerpts; invent nothing.';

export async function POST(req: Request) {
  try {
    const openaiOrResponse = openaiFromRequest(req);
    if (openaiOrResponse instanceof NextResponse) return openaiOrResponse;
    const openai = openaiOrResponse;

    const { sources } = (await req.json()) as SummarizeRequest;
    if (!Array.isArray(sources) || sources.length < 2) {
      return NextResponse.json(
        { error: 'At least two source excerpts are required' },
        { status: 400 }
      );
    }

    const blocks = sources.map((s) => {
      const label = (s.label || 'Source').trim();
      const body = (s.text || '').trim().slice(0, 14_000);
      return `### ${label} (id: ${s.id})\n\n${body}`;
    });

    const userContent =
      `The user selected ${sources.length} nodes on their canvas. Write the brief reference overview (not a full recap).\n\n` +
      blocks.join('\n\n---\n\n');

    const summaryMaxTokens = Math.min(
      420,
      160 + Math.min(sources.length, 10) * 32
    );

    const completion = await openai.chat.completions.create({
      model: RESPONSE_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_SUMMARIZE },
        { role: 'user', content: userContent },
      ],
      max_tokens: summaryMaxTokens,
      temperature: 0.42,
    });

    const response = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!response) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
    }

    const proseOnly = response.replace(/```[\s\S]*?```/g, '').trim();

    const keywordCompletion = await openai.chat.completions.create({
      model: KEYWORD_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Given this short reference overview, pick 3-5 terms that best act as memory hooks—concrete labels that help someone jump back to the underlying ideas. ' +
            'For each term, pick a hex color (muted tones). ' +
            'Return ONLY a JSON array: [{"term": "exact term", "hex": "#abcdef"}]. ' +
            'Terms must appear exactly as in the text.',
        },
        { role: 'user', content: response.slice(0, 14_000) },
      ],
      max_tokens: 250,
      temperature: 0.5,
    });

    const keywordRaw = keywordCompletion.choices[0]?.message?.content?.trim() ?? '[]';
    let keywordEntries: { term: string; hex: string }[] = [];
    try {
      const parsed = JSON.parse(keywordRaw);
      if (Array.isArray(parsed)) {
        keywordEntries = parsed.filter(
          (k): k is { term: string; hex: string } =>
            typeof k === 'object' && typeof k.term === 'string' && typeof k.hex === 'string'
        );
      }
    } catch {
      keywordEntries = [];
    }

    const keywords = keywordEntries
      .map(({ term, hex }) => {
        const span = matchKeywordSpan(response, term);
        if (!span) return null;
        return {
          id: `kw-${span.startIndex}-${span.term.replace(/\s+/g, '-')}`,
          term: span.term,
          startIndex: span.startIndex,
          endIndex: span.endIndex,
          hex: sanitizeHex(hex),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.startIndex - b!.startIndex);

    let title = '';
    try {
      const titleCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Generate a very short title (2-5 words) for this multi-node reference (like a folder label). Return ONLY the title, no quotes.',
          },
          { role: 'user', content: proseOnly.substring(0, 800) },
        ],
        max_tokens: 18,
        temperature: 0.45,
      });
      title = titleCompletion.choices[0]?.message?.content?.trim() ?? '';
    } catch {
      title = '';
    }

    let followUpQuestions: string[] = [];
    try {
      const followupCompletion = await openai.chat.completions.create({
        model: FOLLOWUP_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Given this brief map of selected topics, return ONLY a JSON array with exactly 3 short follow-up prompts ' +
              'that deepen or connect those threads—not generic questions. First person. No markdown.',
          },
          { role: 'user', content: proseOnly.substring(0, 1200) },
        ],
        max_tokens: 180,
        temperature: 0.75,
      });
      const raw = followupCompletion.choices[0]?.message?.content?.trim() ?? '[]';
      followUpQuestions = parseFollowUpQuestions(raw);
    } catch {
      followUpQuestions = [];
    }

    return NextResponse.json({ response, keywords, title, followUpQuestions });
  } catch (error) {
    console.error('Summarize API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
