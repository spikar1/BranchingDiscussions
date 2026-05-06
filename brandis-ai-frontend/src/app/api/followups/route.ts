import { NextResponse } from 'next/server';
import { openaiFromRequest } from '@/app/api/_lib/openaiFromRequest';

export const dynamic = 'force-dynamic';

type FollowUpsRequest = {
  question: string;
  answer: string;
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

export async function POST(req: Request) {
  try {
    const openaiOrResponse = openaiFromRequest(req);
    if (openaiOrResponse instanceof NextResponse) return openaiOrResponse;
    const openai = openaiOrResponse;

    const { question, answer } = (await req.json()) as FollowUpsRequest;

    if (!question?.trim() || !answer?.trim()) {
      return NextResponse.json(
        { error: 'Question and answer are required' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You generate follow-up questions that help a learner use their time meaningfully. ' +
            'Return ONLY a JSON array with exactly 3 concise, practical follow-up prompts. ' +
            'Each item must be phrased as the user asking the AI directly in first person, such as "Can you...", "Help me...", or "Show me...". ' +
            'Prioritize clarifying what matters, applying the idea, and avoiding wasted effort. No markdown.',
        },
        {
          role: 'user',
          content: `Question: ${question}\nAnswer: ${answer.substring(0, 1200)}`,
        },
      ],
      max_tokens: 180,
      temperature: 0.9,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '[]';
    const followUpQuestions = parseFollowUpQuestions(raw);

    return NextResponse.json({ followUpQuestions });
  } catch (error) {
    console.error('Followups API error:', error);
    return NextResponse.json({ followUpQuestions: [] });
  }
}
