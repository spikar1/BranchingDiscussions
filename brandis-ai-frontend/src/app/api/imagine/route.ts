import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ImagineRequest = {
  concept: string;
  context?: string;
};

export async function POST(req: Request) {
  try {
    const { concept, context } = (await req.json()) as ImagineRequest;

    if (!concept?.trim()) {
      return NextResponse.json({ error: 'Concept is required' }, { status: 400 });
    }

    const imagePrompt = context
      ? `A clear, educational illustration representing the concept of "${concept}" in the context of ${context}. Simple, clean, minimal style with soft colors. No text.`
      : `A clear, educational illustration representing the concept of "${concept}". Simple, clean, minimal style with soft colors. No text.`;

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

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Imagine API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
