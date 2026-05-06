import OpenAI from 'openai';
import { NextResponse } from 'next/server';

/** Reads BYOK header first, then dev-only env fallback (prd-task-graph L, PRD §5). */
export function resolveOpenAIApiKey(req: Request): string | undefined {
  const fromHeader = req.headers.get('x-openai-api-key')?.trim();
  if (fromHeader) return fromHeader;
  const fromEnv = process.env.OPENAI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return undefined;
}

export function openaiFromRequest(req: Request): OpenAI | NextResponse {
  const apiKey = resolveOpenAIApiKey(req);
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'Missing OpenAI API key. Add your key in API settings (stored in this browser) or set OPENAI_API_KEY for local development only.',
      },
      { status: 401 }
    );
  }
  return new OpenAI({ apiKey });
}
