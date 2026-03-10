import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Generate ONE short, curiosity-sparking question that someone might want to explore and learn about. ' +
            'It can be about absolutely anything — science, history, philosophy, art, technology, nature, culture, music, cooking, space, language, psychology, etc. ' +
            'Be creative and surprising. No quotation marks. Just the question. 5-10 words max.',
        },
        { role: 'user', content: 'Give me a question.' },
      ],
      max_tokens: 30,
      temperature: 1.2,
    });

    const question = completion.choices[0]?.message?.content?.trim() ?? 'What is Java?';

    return NextResponse.json({ question });
  } catch {
    return NextResponse.json({ question: 'How do black holes form?' });
  }
}
