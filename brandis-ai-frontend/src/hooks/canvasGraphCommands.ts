/**
 * Task B (prd-task-graph): all synchronous graph mutations go through
 * `applyCanvasGraphCommand` so they can be logged for undo / revision replay.
 *
 * Task D: `useCanvasGraph` commits each product mutation as a timeline entry (parent-linked);
 * transient RF updates (selection, in-progress drag/resize) apply without a new revision.
 *
 * React Flow emits structural changes via `react-flow-node-changes` /
 * `react-flow-edge-changes`. App logic uses the other command kinds.
 */

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';

import type { MarkPayload } from '@/components/QANode';
import type {
  ImageNodeRuntimeFlags,
  ImageProductPayload,
  NoteProductPayload,
  PersistedMark,
  QAProductPayload,
  QANodeRuntimeFlags,
  QANodeData,
  SuggestedKeyword,
} from '@/types/canvas';

import { ARROW_MARKER, appendPersistedMarks } from './canvasGraphUtils';

export type CanvasGraphState = {
  nodes: Node[];
  edges: Edge[];
};

export type CanvasGraphCommand =
  | { kind: 'batch'; commands: readonly CanvasGraphCommand[] }
  | { kind: 'set-graph'; nodes: Node[]; edges: Edge[] }
  | { kind: 'react-flow-node-changes'; changes: NodeChange<Node>[] }
  | { kind: 'react-flow-edge-changes'; changes: EdgeChange<Edge>[] }
  | { kind: 'add-edge'; edge: Edge }
  | { kind: 'recolor-mark'; sourceNodeId: string; targetNodeId: string; hex: string }
  | { kind: 'recolor-node'; nodeId: string; hex: string }
  | { kind: 'delete-node'; nodeId: string }
  | {
      kind: 'patch-qa-data';
      nodeId: string;
      patch: Partial<QAProductPayload & QANodeRuntimeFlags>;
    }
  | {
      kind: 'supersede-qa-model-output';
      nodeId: string;
      source: 'retry' | 'expand';
      output: {
        aiResponse: string;
        followUpQuestions: string[];
        keywords: SuggestedKeyword[];
        title?: string;
        persistedMarks?: PersistedMark[];
      };
    }
  | {
      kind: 'patch-image-data';
      nodeId: string;
      patch: Partial<ImageProductPayload & ImageNodeRuntimeFlags>;
    }
  | { kind: 'patch-note-data'; nodeId: string; patch: Partial<NoteProductPayload> }
  | {
      kind: 'append-persisted-marks';
      sourceNodeId: string;
      marks: MarkPayload[];
      color: string;
      targetNodeId: string;
    }
  | { kind: 'append-nodes'; nodes: Node[] }
  | { kind: 'set-edge-label-by-target'; targetNodeId: string; label: string };

const MAX_BATCH_DEPTH = 64;

export function applyCanvasGraphCommand(
  state: CanvasGraphState,
  cmd: CanvasGraphCommand,
  depth = 0
): CanvasGraphState {
  if (depth > MAX_BATCH_DEPTH) {
    console.warn('canvas graph command nesting exceeded; ignoring');
    return state;
  }

  switch (cmd.kind) {
    case 'batch':
      return cmd.commands.reduce(
        (s, c) => applyCanvasGraphCommand(s, c, depth + 1),
        state
      );

    case 'set-graph':
      return { nodes: cmd.nodes, edges: cmd.edges };

    case 'react-flow-node-changes':
      return { ...state, nodes: applyNodeChanges(cmd.changes, state.nodes) };

    case 'react-flow-edge-changes':
      return { ...state, edges: applyEdgeChanges(cmd.changes, state.edges) };

    case 'add-edge':
      return { ...state, edges: addEdge(cmd.edge, state.edges) };

    case 'recolor-mark': {
      const nodes = state.nodes.map((n) => {
        if (n.id === cmd.sourceNodeId) {
          const nodeData = n.data as QANodeData;
          return {
            ...n,
            data: {
              ...n.data,
              persistedMarks: nodeData.persistedMarks.map((m) =>
                m.targetNodeId === cmd.targetNodeId ? { ...m, color: cmd.hex } : m
              ),
            },
          };
        }
        if (n.id === cmd.targetNodeId) {
          return { ...n, data: { ...n.data, branchColor: cmd.hex } };
        }
        return n;
      });
      const edges = state.edges.map((e) => {
        if (e.source === cmd.sourceNodeId && e.target === cmd.targetNodeId) {
          return {
            ...e,
            style: { ...e.style, stroke: cmd.hex },
            markerEnd: { ...ARROW_MARKER, color: cmd.hex },
          };
        }
        return e;
      });
      return { nodes, edges };
    }

    case 'recolor-node': {
      const nodes = state.nodes.map((n) => {
        if (n.id === cmd.nodeId) {
          return { ...n, data: { ...n.data, branchColor: cmd.hex } };
        }
        if (n.type !== 'qa') return n;
        const nd = n.data as QANodeData;
        const hasMatch = nd.persistedMarks?.some((m) => m.targetNodeId === cmd.nodeId);
        if (!hasMatch) return n;
        return {
          ...n,
          data: {
            ...n.data,
            persistedMarks: nd.persistedMarks.map((m) =>
              m.targetNodeId === cmd.nodeId ? { ...m, color: cmd.hex } : m
            ),
          },
        };
      });
      const edges = state.edges.map((e) => {
        if (e.target === cmd.nodeId) {
          return {
            ...e,
            style: { ...e.style, stroke: cmd.hex },
            markerEnd: { ...ARROW_MARKER, color: cmd.hex },
          };
        }
        return e;
      });
      return { nodes, edges };
    }

    case 'delete-node': {
      const nodes = state.nodes
        .filter((n) => n.id !== cmd.nodeId)
        .map((n) => {
          if (n.type !== 'qa') return n;
          const nodeData = n.data as QANodeData;
          if (nodeData.persistedMarks?.some((m) => m.targetNodeId === cmd.nodeId)) {
            return {
              ...n,
              data: {
                ...n.data,
                persistedMarks: nodeData.persistedMarks.filter((m) => m.targetNodeId !== cmd.nodeId),
              },
            };
          }
          return n;
        });
      const edges = state.edges.filter((e) => e.source !== cmd.nodeId && e.target !== cmd.nodeId);
      return { nodes, edges };
    }

    case 'patch-qa-data':
      return {
        ...state,
        nodes: state.nodes.map((n) => {
          if (n.id !== cmd.nodeId || n.type !== 'qa') return n;
          return { ...n, data: { ...n.data, ...cmd.patch } };
        }),
      };

    case 'supersede-qa-model-output': {
      return {
        ...state,
        nodes: state.nodes.map((n) => {
          if (n.id !== cmd.nodeId || n.type !== 'qa') return n;
          const d = n.data as QANodeData & QANodeRuntimeFlags;
          const prior = (d.aiResponse ?? '').trim();
          const archived =
            prior.length > 0
              ? [
                  ...(d.answerRevisions ?? []),
                  {
                    id: crypto.randomUUID(),
                    supersededAt: new Date().toISOString(),
                    source: cmd.source,
                    aiResponse: d.aiResponse,
                    title: d.title,
                    followUpQuestions: [...(d.followUpQuestions ?? [])],
                    keywords: [...(d.keywords ?? [])],
                    persistedMarks: [...(d.persistedMarks ?? [])],
                  },
                ]
              : [...(d.answerRevisions ?? [])];

          return {
            ...n,
            data: {
              ...n.data,
              answerRevisions: archived,
              aiResponse: cmd.output.aiResponse,
              followUpQuestions: cmd.output.followUpQuestions,
              keywords: cmd.output.keywords,
              ...(cmd.output.title !== undefined ? { title: cmd.output.title } : {}),
              persistedMarks:
                cmd.output.persistedMarks !== undefined
                  ? cmd.output.persistedMarks
                  : d.persistedMarks,
              isLoading: false,
              isExpanding: false,
              hasFailed: false,
            },
          };
        }),
      };
    }

    case 'patch-image-data':
      return {
        ...state,
        nodes: state.nodes.map((n) => {
          if (n.id !== cmd.nodeId || n.type !== 'image') return n;
          return { ...n, data: { ...n.data, ...cmd.patch } };
        }),
      };

    case 'patch-note-data':
      return {
        ...state,
        nodes: state.nodes.map((n) => {
          if (n.id !== cmd.nodeId || n.type !== 'note') return n;
          return { ...n, data: { ...n.data, ...cmd.patch } };
        }),
      };

    case 'append-persisted-marks':
      return {
        ...state,
        nodes: appendPersistedMarks(
          state.nodes,
          cmd.sourceNodeId,
          cmd.marks,
          cmd.color,
          cmd.targetNodeId
        ),
      };

    case 'append-nodes':
      return { ...state, nodes: [...state.nodes, ...cmd.nodes] };

    case 'set-edge-label-by-target':
      return {
        ...state,
        edges: state.edges.map((e) =>
          e.target === cmd.targetNodeId
            ? { ...e, data: { ...e.data, label: cmd.label } }
            : e
        ),
      };

    default: {
      const _exhaustive: never = cmd;
      return _exhaustive;
    }
  }
}
