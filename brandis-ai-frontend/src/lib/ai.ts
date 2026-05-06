import { SuggestedKeyword } from '@/types/canvas';
import { withByokHeaders } from '@/lib/byok';

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
  title: string;
  followUpQuestions: string[];
};

export async function explore(params: ExploreParams): Promise<ExploreResult> {
  const res = await fetch('/api/explore', {
    method: 'POST',
    headers: withByokHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

type FollowUpQuestionsParams = {
  question: string;
  answer: string;
};

type FollowUpQuestionsResult = {
  followUpQuestions: string[];
};

export async function getFollowUpQuestions(
  params: FollowUpQuestionsParams
): Promise<FollowUpQuestionsResult> {
  const res = await fetch('/api/followups', {
    method: 'POST',
    headers: withByokHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

type ImagineParams = {
  prompt: string;
  context?: string;
};

type ImagineResult = {
  imageUrl: string;
  title: string;
};

export async function imagine(params: ImagineParams): Promise<ImagineResult> {
  const res = await fetch('/api/imagine', {
    method: 'POST',
    headers: withByokHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

type SummarizeSource = { id: string; label: string; text: string };

type SummarizeResult = {
  response: string;
  keywords: SuggestedKeyword[];
  title: string;
  followUpQuestions: string[];
};

export async function summarizeSelection(sources: SummarizeSource[]): Promise<SummarizeResult> {
  const res = await fetch('/api/summarize', {
    method: 'POST',
    headers: withByokHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ sources }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

type CombineBasisSource = { id: string; label: string; text: string };

type CombineResult = {
  response: string;
  keywords: SuggestedKeyword[];
  title: string;
  followUpQuestions: string[];
};

/** Multi-node synthesis: upstream inputs stay hidden on the map by default (PRD combine). */
export async function combineSelection(sources: CombineBasisSource[]): Promise<CombineResult> {
  const res = await fetch('/api/combine', {
    method: 'POST',
    headers: withByokHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ sources }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}
