'use client';

import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import {
  MarkerType,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';

import { type MarkPayload } from '@/components/QANode';
import { QANodeData, ImageNodeData, NoteNodeData } from '@/types/canvas';
import { explore, imagine, getFollowUpQuestions } from '@/lib/ai';
import { withByokHeaders } from '@/lib/byok';
import {
  appendNewCanvas,
  debouncedSaveCanvas,
  ensureCanvasRegistry,
  flushPendingCanvasSave,
  loadCanvasDocument,
  readRegistry,
  setActiveCanvasIdInRegistry,
  type CanvasMeta,
} from '@/lib/persistence';
import {
  applyCanvasGraphCommand,
  type CanvasGraphCommand,
  type CanvasGraphState,
} from './canvasGraphCommands';
import {
  appendRevision,
  canRedoTimeline,
  canUndoTimeline,
  emptyTimeline,
  redoTimeline,
  replayTimeline,
  undoTimeline,
  type CanvasRevisionTimeline,
} from './canvasRevisionTimeline';
import {
  createEdge,
  createImageReactFlowNode,
  createNoteReactFlowNode,
  createQAReactFlowNode,
  createQANodeData,
  findChildPosition,
  generateId,
} from './canvasGraphUtils';

type CanvasStore = {
  graph: CanvasGraphState;
  timeline: CanvasRevisionTimeline;
};

/** After reload, never resume stuck spinners from persisted commands. */
function stripTransientAILoadingFlags(graph: CanvasGraphState): CanvasGraphState {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isLoading: false,
        isExpanding: false,
        hasFailed: false,
      },
    })),
  };
}

/** Interactions that don't mutate product graph state (selection) or are mid-gesture. */
function isTransientNodeChange(changes: NodeChange<Node>[]): boolean {
  for (const c of changes) {
    if (c.type === 'position' && c.dragging === true) return true;
    if (c.type === 'dimensions' && c.resizing === true) return true;
  }
  if (changes.length > 0 && changes.every((c) => c.type === 'select')) {
    return true;
  }
  return false;
}

function isTransientEdgeChange(changes: EdgeChange<Edge>[]): boolean {
  return changes.length > 0 && changes.every((c) => c.type === 'select');
}

export function useCanvasGraph() {
  const [store, setStore] = useState<CanvasStore>({
    graph: { nodes: [], edges: [] },
    timeline: emptyTimeline(),
  });
  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const [initialPrompt, setInitialPrompt] = useState('');
  const [sparkQuestion, setSparkQuestion] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const activeCanvasIdRef = useRef<string | null>(null);
  const [activeCanvasId, setActiveCanvasIdState] = useState<string | null>(null);
  const [canvasList, setCanvasListState] = useState<CanvasMeta[]>([]);

  const commit = useCallback((cmd: CanvasGraphCommand) => {
    setStore(({ graph, timeline }) => ({
      graph: applyCanvasGraphCommand(graph, cmd),
      timeline: appendRevision(timeline, cmd),
    }));
  }, []);

  const undo = useCallback(() => {
    setStore(({ graph, timeline }) => {
      const nextTimeline = undoTimeline(timeline);
      if (!nextTimeline) return { graph, timeline };
      return { graph: replayTimeline(nextTimeline), timeline: nextTimeline };
    });
  }, []);

  const redo = useCallback(() => {
    setStore(({ graph, timeline }) => {
      const nextTimeline = redoTimeline(timeline);
      if (!nextTimeline) return { graph, timeline };
      return { graph: replayTimeline(nextTimeline), timeline: nextTimeline };
    });
  }, []);

  const applyTransient = useCallback((cmd: CanvasGraphCommand) => {
    setStore(({ graph, timeline }) => ({
      graph: applyCanvasGraphCommand(graph, cmd),
      timeline,
    }));
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      const cmd: CanvasGraphCommand = { kind: 'react-flow-node-changes', changes };
      if (isTransientNodeChange(changes)) {
        applyTransient(cmd);
      } else {
        commit(cmd);
      }
    },
    [commit, applyTransient]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const cmd: CanvasGraphCommand = { kind: 'react-flow-edge-changes', changes };
      if (isTransientEdgeChange(changes)) {
        applyTransient(cmd);
      } else {
        commit(cmd);
      }
    },
    [commit, applyTransient]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'floating',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94a3b8' },
      };
      commit({ kind: 'add-edge', edge: newEdge });
    },
    [commit]
  );

  useEffect(() => {
    const registry = ensureCanvasRegistry();
    activeCanvasIdRef.current = registry.activeCanvasId;
    setActiveCanvasIdState(registry.activeCanvasId);
    setCanvasListState(registry.canvases);
    const doc = loadCanvasDocument(registry.activeCanvasId);
    const timeline = doc?.timeline ?? emptyTimeline();
    setStore({
      graph: stripTransientAILoadingFlags(replayTimeline(timeline)),
      timeline,
    });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !activeCanvasIdRef.current) return;
    debouncedSaveCanvas(activeCanvasIdRef.current, store.timeline);
  }, [hydrated, store.timeline]);

  const selectCanvas = useCallback((canvasId: string) => {
    if (canvasId === activeCanvasIdRef.current) return;
    flushPendingCanvasSave();
    setActiveCanvasIdInRegistry(canvasId);
    activeCanvasIdRef.current = canvasId;
    setActiveCanvasIdState(canvasId);
    setCanvasListState(readRegistry()?.canvases ?? []);
    const doc = loadCanvasDocument(canvasId);
    const timeline = doc?.timeline ?? emptyTimeline();
    setStore({
      graph: stripTransientAILoadingFlags(replayTimeline(timeline)),
      timeline,
    });
    setInitialPrompt('');
  }, []);

  const createBlankCanvas = useCallback(() => {
    flushPendingCanvasSave();
    const nextName = `Canvas ${(readRegistry()?.canvases.length ?? 0) + 1}`;
    const registry = appendNewCanvas(nextName);
    activeCanvasIdRef.current = registry.activeCanvasId;
    setActiveCanvasIdState(registry.activeCanvasId);
    setCanvasListState(registry.canvases);
    setStore({
      graph: { nodes: [], edges: [] },
      timeline: emptyTimeline(),
    });
    setInitialPrompt('');
  }, []);

  useEffect(() => {
    const isTextEditingTarget = (t: EventTarget | null) => {
      if (!t || !(t instanceof HTMLElement)) return false;
      if (t.isContentEditable) return true;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (isTextEditingTarget(e.target)) return;

      const key = e.key.toLowerCase();

      if (key === 'z' && !e.shiftKey) {
        if (!canUndoTimeline(storeRef.current.timeline)) return;
        e.preventDefault();
        e.stopPropagation();
        undo();
        return;
      }

      const redoChord =
        (key === 'z' && e.shiftKey) || (e.ctrlKey && !e.metaKey && key === 'y');
      if (redoChord) {
        if (!canRedoTimeline(storeRef.current.timeline)) return;
        e.preventDefault();
        e.stopPropagation();
        redo();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [undo, redo]);

  const fetchSparkQuestion = useCallback((signal?: AbortSignal) => {
    fetch('/api/spark', { signal, headers: withByokHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { question?: string }) => setSparkQuestion(d.question ?? ''))
      .catch((err: { name?: string }) => {
        if (err?.name !== 'AbortError') setSparkQuestion('How do black holes form?');
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSparkQuestion(controller.signal);
    return () => controller.abort();
  }, [fetchSparkQuestion]);

  const refreshSparkPrompt = useCallback(() => {
    fetchSparkQuestion();
  }, [fetchSparkQuestion]);

  const handleRecolor = useCallback(
    (nodeId: string, targetNodeId: string, newHex: string) => {
      commit({ kind: 'recolor-mark', sourceNodeId: nodeId, targetNodeId, hex: newHex });
    },
    [commit]
  );

  const handleNodeRecolor = useCallback(
    (nodeId: string, newHex: string) => {
      commit({ kind: 'recolor-node', nodeId, hex: newHex });
    },
    [commit]
  );

  const handleDelete = useCallback(
    (nodeId: string) => {
      commit({ kind: 'delete-node', nodeId });
    },
    [commit]
  );

  const handleExpand = useCallback(
    (nodeId: string) => {
      const snap = storeRef.current.graph;
      const node = snap.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const nodeData = node.data as QANodeData;
      const parentNode = nodeData.parentId
        ? snap.nodes.find((n) => n.id === nodeData.parentId)
        : undefined;
      const parentData = parentNode?.data as QANodeData | undefined;

      commit({ kind: 'patch-qa-data', nodeId, patch: { isExpanding: true } });

      (async () => {
        try {
          const { response, keywords, followUpQuestions } = await explore({
            prompt: nodeData.userPrompt,
            markedText: nodeData.branchedFromText ?? undefined,
            parentContext: parentData?.aiResponse
              ? { question: parentData.userPrompt, answer: parentData.aiResponse }
              : undefined,
            expand: true,
            currentAnswer: nodeData.aiResponse,
          });
          commit({
            kind: 'supersede-qa-model-output',
            nodeId,
            source: 'expand',
            output: {
              aiResponse: response,
              followUpQuestions,
              keywords,
              persistedMarks: [],
            },
          });
        } catch (err) {
          console.error('Expand failed:', err);
          commit({ kind: 'patch-qa-data', nodeId, patch: { isExpanding: false } });
        }
      })();
    },
    [commit]
  );

  const handleRetry = useCallback(
    (nodeId: string) => {
      const snap = storeRef.current.graph;
      const node = snap.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const nodeData = node.data as QANodeData;
      const parentNode = nodeData.parentId
        ? snap.nodes.find((n) => n.id === nodeData.parentId)
        : undefined;
      const parentData = parentNode?.data as QANodeData | undefined;

      commit({
        kind: 'patch-qa-data',
        nodeId,
        patch: { isLoading: true, hasFailed: false },
      });

      (async () => {
        try {
          const { response, keywords, title, followUpQuestions } = await explore({
            prompt: nodeData.userPrompt,
            markedText: nodeData.branchedFromText ?? undefined,
            parentContext: parentData?.aiResponse
              ? { question: parentData.userPrompt, answer: parentData.aiResponse }
              : undefined,
          });
          commit({
            kind: 'supersede-qa-model-output',
            nodeId,
            source: 'retry',
            output: {
              aiResponse: response,
              followUpQuestions,
              keywords,
              title: nodeData.title || title,
            },
          });
        } catch (err) {
          console.error('Retry failed:', err);
          commit({
            kind: 'patch-qa-data',
            nodeId,
            patch: {
              isLoading: false,
              hasFailed: true,
            },
          });
        }
      })();
    },
    [commit]
  );

  const handleRegenerateImage = useCallback(
    (imgNodeId: string, newPrompt: string) => {
      const snap = storeRef.current.graph;
      const node = snap.nodes.find((n) => n.id === imgNodeId);
      if (!node) return;
      const capturedContext = (node.data as ImageNodeData).context ?? '';

      commit({
        kind: 'patch-image-data',
        nodeId: imgNodeId,
        patch: { prompt: newPrompt, isLoading: true },
      });

      (async () => {
        try {
          const { imageUrl, title } = await imagine({
            prompt: newPrompt,
            context: capturedContext || undefined,
          });
          const latest = storeRef.current.graph.nodes.find((n) => n.id === imgNodeId);
          const nd = latest?.data as ImageNodeData | undefined;
          commit({
            kind: 'patch-image-data',
            nodeId: imgNodeId,
            patch: {
              imageUrl,
              title,
              images: [{ prompt: newPrompt, title, url: imageUrl }, ...(nd?.images ?? [])],
              isLoading: false,
            },
          });
        } catch (err) {
          console.error('Image regeneration failed:', err);
          commit({ kind: 'patch-image-data', nodeId: imgNodeId, patch: { isLoading: false } });
        }
      })();
    },
    [commit]
  );

  const handleSelectImage = useCallback(
    (imgNodeId: string, url: string) => {
      const snap = storeRef.current.graph;
      const n = snap.nodes.find((x) => x.id === imgNodeId);
      if (!n) return;
      const nd = n.data as ImageNodeData;
      const entry = nd.images.find((img) => img.url === url);
      commit({
        kind: 'patch-image-data',
        nodeId: imgNodeId,
        patch: {
          imageUrl: url,
          title: entry?.title ?? nd.title,
          prompt: entry?.prompt ?? nd.prompt,
        },
      });
    },
    [commit]
  );

  const handleImagine = useCallback(
    (nodeId: string, prompt: string, context: string) => {
      setStore(({ graph, timeline }) => {
        const sourceNode = graph.nodes.find((n) => n.id === nodeId);
        if (!sourceNode) return { graph, timeline };

        const siblingCount = graph.nodes.filter((n) => {
          const d = n.data as QANodeData | ImageNodeData;
          return d.parentId === nodeId;
        }).length;

        const position = findChildPosition(sourceNode, siblingCount);
        const imgNodeId = generateId();

        const imgData: ImageNodeData = {
          id: imgNodeId,
          parentId: nodeId,
          prompt,
          title: '',
          imageUrl: '',
          images: [],
          context,
          createdAt: new Date(),
        };

        const newNode = createImageReactFlowNode(imgData, { position }, { isLoading: true });

        const newEdge = createEdge(
          nodeId,
          imgNodeId,
          { stroke: '#818cf8', strokeWidth: 2, strokeDasharray: '6 3' },
          '#818cf8'
        );

        const batch: CanvasGraphCommand = {
          kind: 'batch',
          commands: [
            { kind: 'append-nodes', nodes: [newNode] },
            { kind: 'add-edge', edge: newEdge },
          ],
        };
        const nextGraph = applyCanvasGraphCommand(graph, batch);
        const nextTimeline = appendRevision(timeline, batch);

        (async () => {
          try {
            const { imageUrl, title } = await imagine({ prompt, context: context || undefined });
            commit({
              kind: 'patch-image-data',
              nodeId: imgNodeId,
              patch: {
                imageUrl,
                title,
                images: [{ prompt, title, url: imageUrl }],
                isLoading: false,
              },
            });
          } catch (err) {
            console.error('Image generation failed:', err);
            commit({ kind: 'delete-node', nodeId: imgNodeId });
          }
        })();

        return { graph: nextGraph, timeline: nextTimeline };
      });
    },
    [commit]
  );

  const handleNote = useCallback((sourceNodeId: string, marks: MarkPayload[], hex: string, fromText?: string) => {
    setStore(({ graph, timeline }) => {
      const sourceNode = graph.nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) return { graph, timeline };

      const siblingCount = graph.nodes.filter((n) => {
        const d = n.data as QANodeData | ImageNodeData | NoteNodeData;
        return 'parentId' in d && d.parentId === sourceNodeId;
      }).length;

      const position = findChildPosition(sourceNode, siblingCount);
      const nodeId = generateId();

      const noteData: NoteNodeData = {
        id: nodeId,
        parentId: sourceNodeId,
        content: '',
        branchColor: hex,
        createdAt: new Date(),
      };

      const newNode = createNoteReactFlowNode(noteData, { position });

      const newEdge = createEdge(
        sourceNodeId,
        nodeId,
        { stroke: hex, strokeWidth: 2, strokeDasharray: '4 4' },
        hex,
        fromText || 'Note'
      );

      const batch: CanvasGraphCommand = {
        kind: 'batch',
        commands: [
          {
            kind: 'append-persisted-marks',
            sourceNodeId,
            marks,
            color: hex,
            targetNodeId: nodeId,
          },
          { kind: 'append-nodes', nodes: [newNode] },
          { kind: 'add-edge', edge: newEdge },
        ],
      };
      return {
        graph: applyCanvasGraphCommand(graph, batch),
        timeline: appendRevision(timeline, batch),
      };
    });
  }, []);

  const handleUpdateNote = useCallback(
    (nodeId: string, content: string) => {
      commit({ kind: 'patch-note-data', nodeId, patch: { content } });
    },
    [commit]
  );

  const handleAsk = useCallback(
    (
      sourceNodeId: string,
      prompt: string,
      marks: MarkPayload[],
      hex: string,
      fromText?: string
    ) => {
      setStore(({ graph, timeline }) => {
        const sourceNode = graph.nodes.find((n) => n.id === sourceNodeId);
        if (!sourceNode) return { graph, timeline };

        const sourceData = sourceNode.data as QANodeData;
        const siblingCount = graph.nodes.filter(
          (n) => (n.data as QANodeData).parentId === sourceNodeId
        ).length;

        const position = findChildPosition(sourceNode, siblingCount);
        const nodeId = generateId();
        const markedText = fromText || undefined;

        const nodeData = createQANodeData({
          id: nodeId,
          prompt,
          parentId: sourceNodeId,
          branchColor: hex,
          branchedFromId: fromText ? sourceNodeId : null,
          branchedFromText: fromText ?? null,
        });

        const newNode = createQAReactFlowNode(nodeData, { position }, { isLoading: true });

        const newEdge = createEdge(
          sourceNodeId,
          nodeId,
          { stroke: hex, strokeWidth: 2 },
          hex,
          fromText || prompt
        );

        const batch: CanvasGraphCommand = {
          kind: 'batch',
          commands: [
            {
              kind: 'append-persisted-marks',
              sourceNodeId,
              marks,
              color: hex,
              targetNodeId: nodeId,
            },
            { kind: 'append-nodes', nodes: [newNode] },
            { kind: 'add-edge', edge: newEdge },
          ],
        };
        const nextGraph = applyCanvasGraphCommand(graph, batch);
        const nextTimeline = appendRevision(timeline, batch);

        (async () => {
          try {
            const { response, keywords, title, followUpQuestions } = await explore({
              prompt,
              markedText,
              parentContext: sourceData.aiResponse
                ? { question: sourceData.userPrompt, answer: sourceData.aiResponse }
                : undefined,
            });
            commit({
              kind: 'patch-qa-data',
              nodeId,
              patch: {
                aiResponse: response,
                followUpQuestions,
                keywords,
                title: title || prompt,
                isLoading: false,
              },
            });
          } catch (err) {
            console.error('AI request failed:', err);
            commit({
              kind: 'patch-qa-data',
              nodeId,
              patch: {
                aiResponse: 'Something went wrong.',
                followUpQuestions: [],
                keywords: [],
                isLoading: false,
                hasFailed: true,
              },
            });
          }
        })();

        return { graph: nextGraph, timeline: nextTimeline };
      });
    },
    [commit]
  );

  const handleCreateDraftFollowUp = useCallback((sourceNodeId: string, prompt: string, hex: string) => {
    setStore(({ graph, timeline }) => {
      const sourceNode = graph.nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) return { graph, timeline };

      const siblingCount = graph.nodes.filter(
        (n) => (n.data as QANodeData).parentId === sourceNodeId
      ).length;
      const position = findChildPosition(sourceNode, siblingCount);
      const nodeId = generateId();

      const nodeData = createQANodeData({
        id: nodeId,
        prompt,
        parentId: sourceNodeId,
        branchColor: hex,
        title: 'New Follow-Up Question',
      });

      const newNode = createQAReactFlowNode(nodeData, { position }, { isAwaitingPrompt: true });

      const newEdge = createEdge(
        sourceNodeId,
        nodeId,
        { stroke: hex, strokeWidth: 2 },
        hex,
        prompt
      );

      const batch: CanvasGraphCommand = {
        kind: 'batch',
        commands: [
          { kind: 'append-nodes', nodes: [newNode] },
          { kind: 'add-edge', edge: newEdge },
        ],
      };
      return {
        graph: applyCanvasGraphCommand(graph, batch),
        timeline: appendRevision(timeline, batch),
      };
    });
  }, []);

  const createRootNode = useCallback(
    (prompt: string) => {
      const nodeId = generateId();

      const nodeData = createQANodeData({
        id: nodeId,
        prompt,
        parentId: null,
        branchColor: null,
      });

      const newNode = createQAReactFlowNode(
        nodeData,
        { position: { x: 0, y: 0 } },
        { isLoading: true }
      );

      commit({ kind: 'set-graph', nodes: [newNode], edges: [] });

      (async () => {
        try {
          const { response, keywords, title, followUpQuestions } = await explore({ prompt });
          commit({
            kind: 'patch-qa-data',
            nodeId,
            patch: {
              aiResponse: response,
              followUpQuestions,
              keywords,
              title: title || prompt,
              isLoading: false,
            },
          });
        } catch (err) {
          console.error('AI request failed:', err);
          commit({
            kind: 'patch-qa-data',
            nodeId,
            patch: {
              aiResponse: 'Something went wrong.',
              followUpQuestions: [],
              keywords: [],
              isLoading: false,
              hasFailed: true,
            },
          });
        }
      })();
    },
    [commit]
  );

  const handleInitialSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const question = initialPrompt.trim() || sparkQuestion.trim();
      if (!question) return;
      createRootNode(question);
      setInitialPrompt('');
    },
    [initialPrompt, sparkQuestion, createRootNode]
  );

  const handleClearCanvas = useCallback(() => {
    if (
      window.confirm(
        'Clear the entire canvas? You can use Undo to bring it back until you make other changes.'
      )
    ) {
      commit({ kind: 'set-graph', nodes: [], edges: [] });
    }
  }, [commit]);

  const handleUpdateTitle = useCallback(
    (nodeId: string, newTitle: string) => {
      commit({ kind: 'patch-qa-data', nodeId, patch: { title: newTitle } });
    },
    [commit]
  );

  const createNodeAt = useCallback(
    (position: { x: number; y: number }) => {
      const nodeId = generateId();
      const nodeData = createQANodeData({
        id: nodeId,
        prompt: '',
        parentId: null,
        branchColor: null,
      });
      const newNode = createQAReactFlowNode(nodeData, { position }, { isAwaitingPrompt: true });
      commit({ kind: 'append-nodes', nodes: [newNode] });
    },
    [commit]
  );

  const handleSubmitRootPrompt = useCallback(
    (nodeId: string, prompt: string) => {
      const snap = storeRef.current.graph;
      const targetNode = snap.nodes.find((n) => n.id === nodeId);
      if (!targetNode) return;
      const targetData = targetNode.data as QANodeData;
      const parentNode = targetData.parentId
        ? snap.nodes.find((n) => n.id === targetData.parentId)
        : undefined;
      const parentData = parentNode?.data as QANodeData | undefined;

      commit({
        kind: 'batch',
        commands: [
          {
            kind: 'patch-qa-data',
            nodeId,
            patch: { userPrompt: prompt, isLoading: true, isAwaitingPrompt: false },
          },
          { kind: 'set-edge-label-by-target', targetNodeId: nodeId, label: prompt },
        ],
      });

      (async () => {
        try {
          const { response, keywords, title, followUpQuestions } = await explore({
            prompt,
            parentContext: parentData?.aiResponse
              ? { question: parentData.userPrompt, answer: parentData.aiResponse }
              : undefined,
          });
          commit({
            kind: 'patch-qa-data',
            nodeId,
            patch: {
              aiResponse: response,
              followUpQuestions,
              keywords,
              title: title || prompt,
              isLoading: false,
            },
          });
        } catch (err) {
          console.error('Root prompt failed:', err);
          commit({
            kind: 'patch-qa-data',
            nodeId,
            patch: { isLoading: false, hasFailed: true },
          });
        }
      })();
    },
    [commit]
  );

  const handleRefreshFollowUps = useCallback(
    async (nodeId: string) => {
      const target = storeRef.current.graph.nodes.find((n) => n.id === nodeId);
      if (!target) return;
      const nodeData = target.data as QANodeData;
      if (!nodeData.userPrompt || !nodeData.aiResponse) return;

      try {
        const { followUpQuestions } = await getFollowUpQuestions({
          question: nodeData.userPrompt,
          answer: nodeData.aiResponse,
        });
        commit({ kind: 'patch-qa-data', nodeId, patch: { followUpQuestions } });
      } catch (err) {
        console.error('Follow-up refresh failed:', err);
      }
    },
    [commit]
  );

  const qaCallbacks = useMemo(
    () => ({
      onAsk: handleAsk,
      onRecolor: handleRecolor,
      onNodeRecolor: handleNodeRecolor,
      onExpand: handleExpand,
      onImagine: handleImagine,
      onDelete: handleDelete,
      onRetry: handleRetry,
      onNote: handleNote,
      onUpdateTitle: handleUpdateTitle,
      onSubmitRootPrompt: handleSubmitRootPrompt,
      onRefreshFollowUps: handleRefreshFollowUps,
      onCreateDraftFollowUp: handleCreateDraftFollowUp,
    }),
    [
      handleAsk,
      handleRecolor,
      handleNodeRecolor,
      handleExpand,
      handleImagine,
      handleDelete,
      handleRetry,
      handleNote,
      handleUpdateTitle,
      handleSubmitRootPrompt,
      handleRefreshFollowUps,
      handleCreateDraftFollowUp,
    ]
  );

  const imageCallbacks = useMemo(
    () => ({
      onDelete: handleDelete,
      onRegenerate: handleRegenerateImage,
      onSelectImage: handleSelectImage,
    }),
    [handleDelete, handleRegenerateImage, handleSelectImage]
  );

  const noteCallbacks = useMemo(
    () => ({
      onDelete: handleDelete,
      onUpdateNote: handleUpdateNote,
    }),
    [handleDelete, handleUpdateNote]
  );

  const nodes = store.graph.nodes;

  const nodesWithCallbacks = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          ...(n.type === 'qa'
            ? qaCallbacks
            : n.type === 'image'
              ? imageCallbacks
              : n.type === 'note'
                ? noteCallbacks
                : { onDelete: handleDelete }),
        },
      })),
    [nodes, qaCallbacks, imageCallbacks, noteCallbacks, handleDelete]
  );

  const canUndo = canUndoTimeline(store.timeline);
  const canRedo = canRedoTimeline(store.timeline);

  return {
    nodes: nodesWithCallbacks,
    edges: store.graph.edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    initialPrompt,
    setInitialPrompt,
    sparkQuestion,
    handleInitialSubmit,
    handleClearCanvas,
    createNodeAt,
    canUndo,
    canRedo,
    undo,
    redo,
    refreshSparkPrompt,
    canvasList,
    activeCanvasId,
    selectCanvas,
    createBlankCanvas,
  };
}
