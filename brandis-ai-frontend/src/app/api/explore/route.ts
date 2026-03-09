import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const RESPONSE_MODEL = 'gpt-4o-mini';
const KEYWORD_MODEL = 'gpt-4o-mini';

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

const SYSTEM_BRIEF =
  'You are a knowledgeable tutor helping someone explore and learn. ' +
  'Answer in exactly ONE sentence. Be precise and mention related concepts naturally so the learner can branch into them. ' +
  'Only include a code example if the question explicitly asks for one — keep it to 1-3 lines in a fenced code block. ' +
  'No bullet points, no numbered lists, no multi-paragraph answers. One sentence only.';

const SYSTEM_EXPAND =
  'You are a knowledgeable tutor helping someone explore and learn. ' +
  'The learner has asked for a more detailed explanation. ' +
  'Expand on the brief answer provided below with a thorough, clear explanation (4-8 sentences). ' +
  'Include relevant examples, nuances, or code examples where helpful. ' +
  'Use fenced code blocks with language tags for any code. ' +
  'Write explanatory text as plain prose — no bullet points or numbered lists.';

export async function POST(req: Request) {
  try {
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
      max_tokens: expand ? 600 : 100,
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
            'Given an educational explanation, identify 3-6 key terms or concepts a learner might explore further. ' +
            'For each term, pick a hex color that people commonly associate with that concept (e.g. "fire" → "#e25822", "ocean" → "#006994", "memory" → "#8b5cf6"). ' +
            'Use muted, pleasant tones — avoid pure primary colors. ' +
            'Return ONLY a JSON array of objects: [{"term": "exact term", "hex": "#abcdef"}]. ' +
            'Terms must appear exactly as in the text. No code syntax or variable names — only conceptual terms from prose.',
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

    return NextResponse.json({ response, keywords });
  } catch (error) {
    console.error('Explore API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
