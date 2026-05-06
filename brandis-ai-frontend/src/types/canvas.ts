/**
 * Product vs view split (prd-task-graph A):
 * - **Payload types** (`*ProductPayload`) are revision/export primitives — no React Flow geometry.
 * - **Geometry** (`CanvasNodeGeometry`) is owned by RF (`position`, optional explicit `width` / `height`).
 * - Components merge payloads with **runtime** UI flags (`QANodeRuntimeFlags`, loading, etc.).
 */

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

/** Prior model output before retry / expand (Task F, §4.4 / §10). */
export type QAModelOutputRevision = {
  id: string;
  supersededAt: string;
  source: 'retry' | 'expand';
  aiResponse: string;
  title: string;
  followUpQuestions: string[];
  keywords: SuggestedKeyword[];
  persistedMarks: PersistedMark[];
};

/** Domain Q&A fields only (historical/export spine). */
export type QAProductPayload = {
  id: string;
  title: string;
  userPrompt: string;
  aiResponse: string;
  followUpQuestions: string[];
  keywords: SuggestedKeyword[];
  persistedMarks: PersistedMark[];
  /** Superseded answers from retry/expand; stored on the node and persisted with the canvas snapshot. */
  answerRevisions: QAModelOutputRevision[];
  parentId: string | null;
  branchedFromId: string | null;
  branchedFromText: string | null;
  branchColor: string | null;
  createdAt: Date;
};

/** @deprecated Prefer `QAProductPayload` — kept for gradual migration. */
export type QANodeData = QAProductPayload;

/** Ephemeral flags stored on RF `node.data`; not part of the product revision model. */
export type QANodeRuntimeFlags = {
  isLoading?: boolean;
  isExpanding?: boolean;
  hasFailed?: boolean;
  isAwaitingPrompt?: boolean;
};

export type ImageEntry = {
  prompt: string;
  title: string;
  url: string;
};

/** Domain image node fields (historical/export spine). */
export type ImageProductPayload = {
  id: string;
  parentId: string;
  prompt: string;
  title: string;
  imageUrl: string;
  images: ImageEntry[];
  context: string;
  createdAt: Date;
};

/** @deprecated Prefer `ImageProductPayload`. */
export type ImageNodeData = ImageProductPayload;

export type ImageNodeRuntimeFlags = {
  isLoading?: boolean;
};

/** Domain note fields (historical/export spine). */
export type NoteProductPayload = {
  id: string;
  parentId: string;
  content: string;
  branchColor: string;
  createdAt: Date;
};

/** @deprecated Prefer `NoteProductPayload`. */
export type NoteNodeData = NoteProductPayload;

/** Placement on the RF canvas — distinct from semantic node payloads. */
export type CanvasNodeGeometry = {
  position: { x: number; y: number };
  width?: number;
  height?: number;
};

/** One node as product + geometry (precursor for per-canvas export in P1). */
export type CanvasProductEnvelope =
  | { kind: 'qa'; geometry: CanvasNodeGeometry; payload: QAProductPayload }
  | { kind: 'image'; geometry: CanvasNodeGeometry; payload: ImageProductPayload }
  | { kind: 'note'; geometry: CanvasNodeGeometry; payload: NoteProductPayload };

export type Canvas = {
  id: string;
  title: string;
  nodes: QANodeData[];
  createdAt: Date;
};
