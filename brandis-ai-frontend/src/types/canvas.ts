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
  title: string;
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

export type ImageEntry = {
  prompt: string;
  title: string;
  url: string;
};

export type ImageNodeData = {
  id: string;
  parentId: string;
  prompt: string;
  title: string;
  imageUrl: string;
  images: ImageEntry[];
  context: string;
  createdAt: Date;
};

export type NoteNodeData = {
  id: string;
  parentId: string;
  content: string;
  branchColor: string;
  createdAt: Date;
};

export type Canvas = {
  id: string;
  title: string;
  nodes: QANodeData[];
  createdAt: Date;
};
