import { SuggestedKeyword } from '@/types/canvas';

type ExploreParams = {
  prompt: string;
  markedText?: string;
  parentContext?: {
    question: string;
    answer: string;
  };
  expand?: boolean;
  currentAnswer?: string;
};

type ExploreResult = {
  response: string;
  keywords: SuggestedKeyword[];
};

export async function explore(params: ExploreParams): Promise<ExploreResult> {
  const res = await fetch('/api/explore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

type ImagineParams = {
  concept: string;
  context?: string;
};

type ImagineResult = {
  imageUrl: string;
};

export async function imagine(params: ImagineParams): Promise<ImagineResult> {
  const res = await fetch('/api/imagine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}
