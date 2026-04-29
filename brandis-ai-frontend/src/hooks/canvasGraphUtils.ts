import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { type PersistedMark, type QANodeData } from '@/types/canvas';

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

export function createQANodeData(input: {
  id: string;
  prompt: string;
  parentId: string | null;
  branchColor: string | null;
  branchedFromId?: string | null;
  branchedFromText?: string | null;
  title?: string;
}): QANodeData {
  return {
    id: input.id,
    title: input.title ?? '',
    userPrompt: input.prompt,
    aiResponse: '',
    followUpQuestions: [],
    keywords: [],
    persistedMarks: [],
    parentId: input.parentId,
    branchedFromId: input.branchedFromId ?? null,
    branchedFromText: input.branchedFromText ?? null,
    branchColor: input.branchColor,
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
    const existingMarks = (n.data as QANodeData).persistedMarks ?? [];
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
