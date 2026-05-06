import { MarkerType, type Edge, type Node } from '@xyflow/react';
import {
  type CanvasNodeGeometry,
  type CanvasProductEnvelope,
  type ImageProductPayload,
  type NoteProductPayload,
  type PersistedMark,
  type QAModelOutputRevision,
  type QAProductPayload,
} from '@/types/canvas';

function coerceStyleLength(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.endsWith('px')) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** RF-owned placement (position + optional explicit size for history/export). */
export function geometryFromReactFlowNode(node: Node): CanvasNodeGeometry {
  const style = node.style ?? {};
  return {
    position: { x: node.position.x, y: node.position.y },
    width:
      coerceStyleLength(style.width) ??
      (typeof node.width === 'number' ? node.width : undefined) ??
      (typeof node.measured?.width === 'number' ? node.measured!.width : undefined),
    height:
      coerceStyleLength(style.height) ??
      (typeof node.height === 'number' ? node.height : undefined) ??
      (typeof node.measured?.height === 'number' ? node.measured!.height : undefined),
  };
}

function coerceAnswerRevisions(raw: unknown): QAModelOutputRevision[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is QAModelOutputRevision =>
      r != null &&
      typeof r === 'object' &&
      typeof (r as QAModelOutputRevision).id === 'string' &&
      typeof (r as QAModelOutputRevision).supersededAt === 'string' &&
      ((r as QAModelOutputRevision).source === 'retry' ||
        (r as QAModelOutputRevision).source === 'expand') &&
      typeof (r as QAModelOutputRevision).aiResponse === 'string'
  );
}

export function qaPayloadFromFlowData(
  raw: QAProductPayload & Record<string, unknown>
): QAProductPayload {
  return {
    id: raw.id,
    title: raw.title,
    userPrompt: raw.userPrompt,
    aiResponse: raw.aiResponse,
    followUpQuestions: raw.followUpQuestions,
    keywords: raw.keywords,
    persistedMarks: raw.persistedMarks,
    answerRevisions: coerceAnswerRevisions(raw.answerRevisions),
    parentId: raw.parentId,
    branchedFromId: raw.branchedFromId,
    branchedFromText: raw.branchedFromText,
    branchColor: raw.branchColor,
    summarySourceIds: Array.isArray(raw.summarySourceIds)
      ? raw.summarySourceIds.filter((id): id is string => typeof id === 'string')
      : undefined,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(String(raw.createdAt)),
  };
}

export function imagePayloadFromFlowData(
  raw: ImageProductPayload & Record<string, unknown>
): ImageProductPayload {
  return {
    id: raw.id,
    parentId: raw.parentId,
    prompt: raw.prompt,
    title: raw.title,
    imageUrl: raw.imageUrl,
    images: raw.images,
    context: raw.context,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(String(raw.createdAt)),
  };
}

export function notePayloadFromFlowData(
  raw: NoteProductPayload & Record<string, unknown>
): NoteProductPayload {
  return {
    id: raw.id,
    parentId: raw.parentId,
    content: raw.content,
    branchColor: raw.branchColor,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(String(raw.createdAt)),
  };
}

/** Product envelope + RF geometry — runtime flags stripped from data. */
export function reactFlowNodeToProductEnvelope(node: Node): CanvasProductEnvelope | null {
  const geometry = geometryFromReactFlowNode(node);
  switch (node.type) {
    case 'qa':
      return {
        kind: 'qa',
        geometry,
        payload: qaPayloadFromFlowData(node.data as QAProductPayload & Record<string, unknown>),
      };
    case 'image':
      return {
        kind: 'image',
        geometry,
        payload: imagePayloadFromFlowData(node.data as ImageProductPayload & Record<string, unknown>),
      };
    case 'note':
      return {
        kind: 'note',
        geometry,
        payload: notePayloadFromFlowData(node.data as NoteProductPayload & Record<string, unknown>),
      };
    default:
      return null;
  }
}

export function canvasProductEnvelopesFromReactFlow(nodes: Node[]): CanvasProductEnvelope[] {
  return nodes
    .map((n) => reactFlowNodeToProductEnvelope(n))
    .filter((e): e is CanvasProductEnvelope => e != null);
}

function buildStyleFromGeometry(defaultWidth: number, geometry: CanvasNodeGeometry): { width?: number; height?: number } {
  const style: { width?: number; height?: number } = {};
  if (geometry.width != null) style.width = geometry.width;
  if (geometry.height != null) style.height = geometry.height;
  if (geometry.width == null && geometry.height == null) style.width = defaultWidth;
  return style;
}

export function createQAReactFlowNode(
  payload: QAProductPayload,
  geometry: CanvasNodeGeometry,
  dataExtra?: Record<string, unknown>
): Node {
  return {
    id: payload.id,
    type: 'qa',
    position: { ...geometry.position },
    style: buildStyleFromGeometry(380, geometry),
    data: dataExtra ? { ...payload, ...dataExtra } : { ...payload },
  };
}

export function createImageReactFlowNode(
  payload: ImageProductPayload,
  geometry: CanvasNodeGeometry,
  dataExtra?: Record<string, unknown>
): Node {
  return {
    id: payload.id,
    type: 'image',
    position: { ...geometry.position },
    style: buildStyleFromGeometry(280, geometry),
    data: dataExtra ? { ...payload, ...dataExtra } : { ...payload },
  };
}

export function createNoteReactFlowNode(
  payload: NoteProductPayload,
  geometry: CanvasNodeGeometry,
  dataExtra?: Record<string, unknown>
): Node {
  return {
    id: payload.id,
    type: 'note',
    position: { ...geometry.position },
    style: buildStyleFromGeometry(280, geometry),
    data: dataExtra ? { ...payload, ...dataExtra } : { ...payload },
  };
}

type MarkPayload = {
  text: string;
  startIndex: number;
  endIndex: number;
};

const RADIUS_BASE = 350;
const RADIUS_GROWTH = 80;

export const ARROW_MARKER = {
  type: MarkerType.ArrowClosed,
  width: 16,
  height: 16,
};

export function generateId() {
  return `node-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function getChildAngle(childIndex: number, totalSiblings: number): number {
  if (totalSiblings === 1) return Math.PI / 2;
  const spread = Math.min(Math.PI * 1.6, (Math.PI / 3) * totalSiblings);
  const startAngle = Math.PI / 2 - spread / 2;
  const step = totalSiblings > 1 ? spread / (totalSiblings - 1) : 0;
  return startAngle + step * childIndex;
}

export function findChildPosition(sourceNode: Node, existingSiblingCount: number): { x: number; y: number } {
  const radius = RADIUS_BASE + existingSiblingCount * RADIUS_GROWTH;
  const angle = getChildAngle(existingSiblingCount, existingSiblingCount + 1);
  return {
    x: sourceNode.position.x + Math.cos(angle) * radius,
    y: sourceNode.position.y + Math.sin(angle) * radius,
  };
}

export type SummarizeSourcePayload = {
  id: string;
  label: string;
  text: string;
};

const MAX_SUMMARIZE_CHUNK = 12_000;

/** Extract readable text from a canvas node for multi-node summarization (PRD §4.2). */
export function nodeToSummarizeSource(node: Node): SummarizeSourcePayload | null {
  if (node.type === 'qa') {
    const d = qaPayloadFromFlowData(node.data as QAProductPayload & Record<string, unknown>);
    const title = (d.title || '').trim();
    const q = (d.userPrompt || '').trim();
    const a = (d.aiResponse || '').trim();
    const text = [title && `Title: ${title}`, q && `Question: ${q}`, a && `Answer:\n${a}`]
      .filter(Boolean)
      .join('\n\n')
      .trim()
      .slice(0, MAX_SUMMARIZE_CHUNK);
    if (text.length < 8) return null;
    return { id: node.id, label: title || q || 'Q&A', text };
  }
  if (node.type === 'note') {
    const d = notePayloadFromFlowData(node.data as NoteProductPayload & Record<string, unknown>);
    const text = (d.content || '').trim().slice(0, MAX_SUMMARIZE_CHUNK);
    if (text.length < 8) return null;
    return { id: node.id, label: 'Note', text };
  }
  if (node.type === 'image') {
    const d = imagePayloadFromFlowData(node.data as ImageProductPayload & Record<string, unknown>);
    const text = [d.title && `Title: ${d.title}`, d.prompt && `Prompt: ${d.prompt}`, d.context && `Context: ${d.context}`]
      .filter(Boolean)
      .join('\n\n')
      .trim()
      .slice(0, MAX_SUMMARIZE_CHUNK);
    if (text.length < 8) return null;
    return { id: node.id, label: d.title || 'Image', text };
  }
  return null;
}

export function createQANodeData(input: {
  id: string;
  prompt: string;
  parentId: string | null;
  branchColor: string | null;
  branchedFromId?: string | null;
  branchedFromText?: string | null;
  title?: string;
  summarySourceIds?: string[];
}): QAProductPayload {
  return {
    id: input.id,
    title: input.title ?? '',
    userPrompt: input.prompt,
    aiResponse: '',
    followUpQuestions: [],
    keywords: [],
    persistedMarks: [],
    answerRevisions: [],
    parentId: input.parentId,
    branchedFromId: input.branchedFromId ?? null,
    branchedFromText: input.branchedFromText ?? null,
    branchColor: input.branchColor,
    ...(input.summarySourceIds && input.summarySourceIds.length > 0
      ? { summarySourceIds: [...input.summarySourceIds] }
      : {}),
    createdAt: new Date(),
  };
}

export function appendPersistedMarks(
  currentNodes: Node[],
  sourceNodeId: string,
  marks: MarkPayload[],
  color: string,
  targetNodeId: string
): Node[] {
  if (marks.length === 0) return currentNodes;

  return currentNodes.map((n) => {
    if (n.id !== sourceNodeId) return n;
    const existingMarks = (n.data as QAProductPayload).persistedMarks ?? [];
    const newPersistedMarks: PersistedMark[] = marks.map((m) => ({
      text: m.text,
      startIndex: m.startIndex,
      endIndex: m.endIndex,
      color,
      targetNodeId,
    }));
    return {
      ...n,
      data: { ...n.data, persistedMarks: [...existingMarks, ...newPersistedMarks] },
    };
  });
}

export function createEdge(
  source: string,
  target: string,
  style: Edge['style'],
  color: string,
  label?: string
): Edge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    type: 'floating',
    style,
    markerEnd: { ...ARROW_MARKER, color },
    data: label ? { label } : undefined,
  };
}
