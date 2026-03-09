export type SuggestedKeyword = {
  id: string;
  term: string;
  startIndex: number;
  endIndex: number;
  hex: string;
};

export type PersistedMark = {
  text: string;
  startIndex: number;
  endIndex: number;
  color: string;
  targetNodeId: string;
};

export type QANodeData = {
  id: string;
  userPrompt: string;
  aiResponse: string;
  keywords: SuggestedKeyword[];
  persistedMarks: PersistedMark[];
  parentId: string | null;
  branchedFromId: string | null;
  branchedFromText: string | null;
  branchColor: string | null;
  createdAt: Date;
};

export type ImageNodeData = {
  id: string;
  parentId: string;
  prompt: string;
  imageUrl: string;
  createdAt: Date;
};

export type Canvas = {
  id: string;
  title: string;
  nodes: QANodeData[];
  createdAt: Date;
};
