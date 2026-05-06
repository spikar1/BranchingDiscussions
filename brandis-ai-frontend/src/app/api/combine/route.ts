import { NextResponse } from 'next/server';

import { openaiFromRequest } from '@/app/api/_lib/openaiFromRequest';
import { sanitizeHex } from '@/lib/colors';
import { matchKeywordSpan } from '@/lib/keywordSpans';

const RESPONSE_MODEL = 'gpt-4o-mini';
const KEYWORD_MODEL = 'gpt-4o-mini';
const FOLLOWUP_MODEL = 'gpt-4o-mini';

export const dynamic = 'force-dynamic';

type CombineRequest = {
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

const SYSTEM_COMBINE =
  'The user is merging several canvas nodes into ONE living synthesis node. Your job is to write a single coherent answer ' +
  'that integrates the themes, resolves overlaps, and surfaces tensions or disagreements clearly.\n\n' +
  'These excerpts are **frozen snapshots** from their map—treat them as the authoritative basis at combine time; do not invent facts beyond them. ' +
  'Prefer structured markdown (short sections or bullets) when it aids clarity. ' +
  'This text becomes their primary working surface—be substantive but not repetitive with the sources.';

export async function POST(req: Request) {
  try {
    const openaiOrResponse = openaiFromRequest(req);
    if (openaiOrResponse instanceof NextResponse) return openaiOrResponse;
    const openai = openaiOrResponse;

    const { sources } = (await req.json()) as CombineRequest;
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
      `Combine these ${sources.length} pinned inputs into one synthesized answer for the canvas.\n\n` +
      blocks.join('\n\n---\n\n');

    const synthesisMaxTokens = Math.min(
      2_048,
      480 + Math.min(sources.length, 12) * 120
    );

    const completion = await openai.chat.completions.create({
      model: RESPONSE_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_COMBINE },
        { role: 'user', content: userContent },
      ],
      max_tokens: synthesisMaxTokens,
      temperature: 0.45,
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
            'Given this synthesized answer, pick 3-6 terms that act as memory hooks for navigating it. ' +
            'For each term, pick a hex color (muted tones). ' +
            'Return ONLY a JSON array: [{"term": "exact term", "hex": "#abcdef"}]. ' +
            'Terms must appear exactly as in the text.',
        },
        { role: 'user', content: proseOnly.slice(0, 14_000) },
      ],
      max_tokens: 280,
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
              'Generate a very short title (2-6 words) for this combined synthesis. Return ONLY the title, no quotes.',
          },
          { role: 'user', content: proseOnly.substring(0, 900) },
        ],
        max_tokens: 22,
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
              'Given this synthesis, return ONLY a JSON array with exactly 3 short follow-up prompts ' +
              'that push the integrated idea further—not generic questions. First person. No markdown.',
          },
          { role: 'user', content: proseOnly.substring(0, 1400) },
        ],
        max_tokens: 200,
        temperature: 0.75,
      });
      const raw = followupCompletion.choices[0]?.message?.content?.trim() ?? '[]';
      followUpQuestions = parseFollowUpQuestions(raw);
    } catch {
      followUpQuestions = [];
    }

    return NextResponse.json({ response, keywords, title, followUpQuestions });
  } catch (error) {
    console.error('Combine API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
