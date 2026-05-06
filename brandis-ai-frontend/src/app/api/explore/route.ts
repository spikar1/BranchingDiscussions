import { NextResponse } from 'next/server';
import OpenAI from 'openai';

import { openaiFromRequest } from '@/app/api/_lib/openaiFromRequest';

const RESPONSE_MODEL = 'gpt-4o-mini';
const KEYWORD_MODEL = 'gpt-4o-mini';
const FOLLOWUP_MODEL = 'gpt-4o-mini';

export const dynamic = 'force-dynamic';

type ExploreRequest = {
  prompt: string;
  markedText?: string;
  parentContext?: {
    question: string;
    answer: string;
  };
  expand?: boolean;
  currentAnswer?: string;
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

const SYSTEM_BRIEF =
  'You are a knowledgeable assistant helping someone explore and learn. ' +
  'Match your response format to what the user is asking for:\n' +
  '- **Concept/explanation**: Be concise — default to ONE sentence. Mention related concepts naturally.\n' +
  '- **List/enumeration**: Respond with a markdown list (using "- " for each item). Keep items short.\n' +
  '- **Verbatim content** (lyrics, poems, quotes, recipes, speeches, excerpts, formulas): ' +
  'Provide the content DIRECTLY with no preamble, no commentary, no "Here are the lyrics" — just the content itself. ' +
  'If the content is long, provide it in full. If you cannot provide the exact text (e.g. copyright), give the closest faithful version you can and note any uncertainty in a single short line at the end.\n' +
  'Only include a code example if the question explicitly asks for one — keep it to 1-3 lines in a fenced code block.';

const SYSTEM_EXPAND =
  'You are a knowledgeable tutor helping someone explore and learn. ' +
  'The learner has asked for a more detailed explanation. ' +
  'Expand on the brief answer provided below with a thorough, clear explanation (4-8 sentences). ' +
  'Include relevant examples, nuances, or code examples where helpful. ' +
  'Use fenced code blocks with language tags for any code. ' +
  'Use markdown lists (with "- ") when enumerating items. Otherwise write as plain prose.';

export async function POST(req: Request) {
  try {
    const openaiOrResponse = openaiFromRequest(req);
    if (openaiOrResponse instanceof NextResponse) return openaiOrResponse;
    const openai = openaiOrResponse;

    const { prompt, markedText, parentContext, expand, currentAnswer } =
      (await req.json()) as ExploreRequest;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: expand ? SYSTEM_EXPAND : SYSTEM_BRIEF },
    ];

    if (parentContext) {
      messages.push(
        { role: 'user', content: parentContext.question },
        { role: 'assistant', content: parentContext.answer }
      );
    }

    if (expand && currentAnswer) {
      messages.push(
        { role: 'user', content: prompt },
        { role: 'assistant', content: currentAnswer },
        { role: 'user', content: 'Please give me a more detailed and thorough explanation of this.' }
      );
    } else if (markedText) {
      messages.push({
        role: 'user',
        content: `In the previous explanation, I want to understand more about: "${markedText}". ${prompt}`,
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const completion = await openai.chat.completions.create({
      model: RESPONSE_MODEL,
      messages,
      max_tokens: expand ? 600 : 500,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content?.trim() ?? '';

    if (!response) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
    }

    const proseOnly = response.replace(/```[\s\S]*?```/g, '').trim();

    // Extract keywords AND their associated colors in one call
    const keywordCompletion = await openai.chat.completions.create({
      model: KEYWORD_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Given a text, identify 3-6 key terms, concepts, or notable references a curious reader might want to explore further. ' +
            'For lyrics/poems, pick thematic words, literary references, or cultural terms. ' +
            'For explanations, pick concepts the learner could branch into. ' +
            'For each term, pick a hex color that people commonly associate with that concept (e.g. "fire" → "#e25822", "ocean" → "#006994", "memory" → "#8b5cf6"). ' +
            'Use muted, pleasant tones — avoid pure primary colors. ' +
            'Return ONLY a JSON array of objects: [{"term": "exact term", "hex": "#abcdef"}]. ' +
            'Terms must appear exactly as in the text. No code syntax or variable names.',
        },
        { role: 'user', content: proseOnly },
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
        const lowerResponse = response.toLowerCase();
        const lowerTerm = term.toLowerCase();
        const index = lowerResponse.indexOf(lowerTerm);
        if (index === -1) return null;
        return {
          id: `kw-${index}-${term.replace(/\s+/g, '-')}`,
          term: response.substring(index, index + term.length),
          startIndex: index,
          endIndex: index + term.length,
          hex,
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
            content: 'Generate a very short title (2-5 words) that captures the topic of this Q&A. Return ONLY the title, no quotes, no punctuation at the end.',
          },
          { role: 'user', content: `Question: "${prompt}"\nAnswer: "${proseOnly.substring(0, 200)}"` },
        ],
        max_tokens: 15,
        temperature: 0.5,
      });
      title = titleCompletion.choices[0]?.message?.content?.trim() ?? '';
    } catch {
      // fall back to empty — the UI will use the prompt as fallback
    }

    let followUpQuestions: string[] = [];
    try {
      const followupCompletion = await openai.chat.completions.create({
        model: FOLLOWUP_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You generate follow-up questions that help a learner make meaningful progress quickly. ' +
              'Given a question and answer, return ONLY a JSON array with exactly 3 short, high-value follow-up prompts. ' +
              'Write each item as the user speaking directly to the AI (first person), e.g. "Can you explain...", "Help me understand...", "Show me...". ' +
              'Questions should be practical, clarifying, and focused on next-step understanding. ' +
              'Avoid vague, repetitive, or trivia questions. No markdown.',
          },
          {
            role: 'user',
            content: `Question: ${prompt}\nAnswer: ${proseOnly.substring(0, 1200)}`,
          },
        ],
        max_tokens: 180,
        temperature: 0.8,
      });
      const raw = followupCompletion.choices[0]?.message?.content?.trim() ?? '[]';
      followUpQuestions = parseFollowUpQuestions(raw);
    } catch {
      followUpQuestions = [];
    }

    return NextResponse.json({ response, keywords, title, followUpQuestions });
  } catch (error) {
    console.error('Explore API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
