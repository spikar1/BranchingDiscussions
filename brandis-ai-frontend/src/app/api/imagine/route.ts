import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ImagineRequest = {
  prompt: string;
  context?: string;
};

export async function POST(req: Request) {
  try {
    const { prompt, context } = (await req.json()) as ImagineRequest;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const imagePrompt = context
      ? `A clear, educational illustration representing the concept of "${prompt}" in the context of ${context}. Simple, clean, minimal style with soft colors. No text.`
      : `A clear, educational illustration representing the concept of "${prompt}". Simple, clean, minimal style with soft colors. No text.`;

    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const imageUrl = result.data?.[0]?.url;

    if (!imageUrl) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    let title = prompt.length > 40 ? prompt.substring(0, 40) + '…' : prompt;
    try {
      const titleCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Generate a short, descriptive title (3-6 words) for an educational illustration. Return ONLY the title, no quotes, no punctuation at the end.',
          },
          { role: 'user', content: `Prompt: "${prompt}"${context ? `\nContext: ${context}` : ''}` },
        ],
        max_tokens: 20,
        temperature: 0.7,
      });
      const generated = titleCompletion.choices[0]?.message?.content?.trim();
      if (generated) title = generated;
    } catch {
      // fall back to truncated prompt
    }

    return NextResponse.json({ imageUrl, title });
  } catch (error) {
    console.error('Imagine API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
