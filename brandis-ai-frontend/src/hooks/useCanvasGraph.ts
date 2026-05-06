'use client';

import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import {
  MarkerType,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react';

import { type MarkPayload } from '@/components/QANode';
import { QANodeData, ImageNodeData, NoteNodeData } from '@/types/canvas';
import { explore, imagine, getFollowUpQuestions } from '@/lib/ai';
import { loadCanvas, debouncedSave, clearCanvas } from '@/lib/persistence';
import {
  applyCanvasGraphCommand,
  type CanvasGraphCommand,
  type CanvasGraphState,
} from './canvasGraphCommands';
import {
  createEdge,
  createImageReactFlowNode,
  createNoteReactFlowNode,
  createQAReactFlowNode,
  createQANodeData,
  findChildPosition,
  generateId,
} from './canvasGraphUtils';

export function useCanvasGraph() {
  const [graph, setGraph] = useState<CanvasGraphState>({ nodes: [], edges: [] });
  const graphRef = useRef(graph);
  graphRef.current = graph;

  const [initialPrompt, setInitialPrompt] = useState('');
  const [sparkQuestion, setSparkQuestion] = useState('');
  const hasRestored = useRef(false);

  const dispatch = useCallback((cmd: CanvasGraphCommand) => {
    setGraph((s) => applyCanvasGraphCommand(s, cmd));
  }, []);

  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    setGraph((s) =>
      applyCanvasGraphCommand(s, { kind: 'react-flow-node-changes', changes })
    );
  }, []);

  const onEdgesChange = useCallback(
    (changes: import('@xyflow/react').EdgeChange<Edge>[]) => {
      setGraph((s) =>
        applyCanvasGraphCommand(s, { kind: 'react-flow-edge-changes', changes })
      );
    },
    []
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
      dispatch({ kind: 'add-edge', edge: newEdge });
    },
    [dispatch]
  );

  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;
    const saved = loadCanvas();
    if (saved && saved.nodes.length > 0) {
      setGraph({ nodes: saved.nodes, edges: saved.edges });
    }
  }, []);

  useEffect(() => {
    if (!hasRestored.current) return;
    if (graph.nodes.length > 0) {
      debouncedSave(graph.nodes, graph.edges);
    }
  }, [graph.nodes, graph.edges]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/spark', { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setSparkQuestion(d.question ?? ''))
      .catch((err) => {
        if (err.name !== 'AbortError') setSparkQuestion('How do black holes form?');
      });
    return () => controller.abort();
  }, []);

  const handleRecolor = useCallback(
    (nodeId: string, targetNodeId: string, newHex: string) => {
      dispatch({ kind: 'recolor-mark', sourceNodeId: nodeId, targetNodeId, hex: newHex });
    },
    [dispatch]
  );

  const handleNodeRecolor = useCallback(
    (nodeId: string, newHex: string) => {
      dispatch({ kind: 'recolor-node', nodeId, hex: newHex });
    },
    [dispatch]
  );

  const handleDelete = useCallback(
    (nodeId: string) => {
      dispatch({ kind: 'delete-node', nodeId });
    },
    [dispatch]
  );

  const handleExpand = useCallback(
    (nodeId: string) => {
      const snap = graphRef.current;
      const node = snap.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const nodeData = node.data as QANodeData;
      const parentNode = nodeData.parentId
        ? snap.nodes.find((n) => n.id === nodeData.parentId)
        : undefined;
      const parentData = parentNode?.data as QANodeData | undefined;

      dispatch({ kind: 'patch-qa-data', nodeId, patch: { isExpanding: true } });

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
          dispatch({
            kind: 'patch-qa-data',
            nodeId,
            patch: {
              aiResponse: response,
              followUpQuestions,
              keywords,
              persistedMarks: [],
              isExpanding: false,
            },
          });
        } catch (err) {
          console.error('Expand failed:', err);
          dispatch({ kind: 'patch-qa-data', nodeId, patch: { isExpanding: false } });
        }
      })();
    },
    [dispatch]
  );

  const handleRetry = useCallback(
    (nodeId: string) => {
      const snap = graphRef.current;
      const node = snap.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const nodeData = node.data as QANodeData;
      const parentNode = nodeData.parentId
        ? snap.nodes.find((n) => n.id === nodeData.parentId)
        : undefined;
      const parentData = parentNode?.data as QANodeData | undefined;

      dispatch({
        kind: 'patch-qa-data',
        nodeId,
        patch: { isLoading: true, hasFailed: false, aiResponse: '' },
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
          dispatch({
            kind: 'patch-qa-data',
            nodeId,
            patch: {
              aiResponse: response,
              followUpQuestions,
              keywords,
              title: nodeData.title || title,
              isLoading: false,
            },
          });
        } catch (err) {
          console.error('Retry failed:', err);
          dispatch({
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
    [dispatch]
  );

  const handleRegenerateImage = useCallback(
    (imgNodeId: string, newPrompt: string) => {
      const snap = graphRef.current;
      const node = snap.nodes.find((n) => n.id === imgNodeId);
      if (!node) return;
      const capturedContext = (node.data as ImageNodeData).context ?? '';

      dispatch({
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
          const latest = graphRef.current.nodes.find((n) => n.id === imgNodeId);
          const nd = latest?.data as ImageNodeData | undefined;
          dispatch({
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
          dispatch({ kind: 'patch-image-data', nodeId: imgNodeId, patch: { isLoading: false } });
        }
      })();
    },
    [dispatch]
  );

  const handleSelectImage = useCallback(
    (imgNodeId: string, url: string) => {
      setGraph((state) => {
        const n = state.nodes.find((x) => x.id === imgNodeId);
        if (!n) return state;
        const nd = n.data as ImageNodeData;
        const entry = nd.images.find((img) => img.url === url);
        return applyCanvasGraphCommand(state, {
          kind: 'patch-image-data',
          nodeId: imgNodeId,
          patch: {
            imageUrl: url,
            title: entry?.title ?? nd.title,
            prompt: entry?.prompt ?? nd.prompt,
          },
        });
      });
    },
    []
  );

  const handleImagine = useCallback(
    (nodeId: string, prompt: string, context: string) => {
      setGraph((current) => {
        const sourceNode = current.nodes.find((n) => n.id === nodeId);
        if (!sourceNode) return current;

        const siblingCount = current.nodes.filter((n) => {
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

        let next = applyCanvasGraphCommand(current, { kind: 'append-nodes', nodes: [newNode] });
        next = applyCanvasGraphCommand(next, { kind: 'add-edge', edge: newEdge });

        (async () => {
          try {
            const { imageUrl, title } = await imagine({ prompt, context: context || undefined });
            dispatch({
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
            dispatch({ kind: 'delete-node', nodeId: imgNodeId });
          }
        })();

        return next;
      });
    },
    [dispatch]
  );

  const handleNote = useCallback(
    (sourceNodeId: string, marks: MarkPayload[], hex: string, fromText?: string) => {
      setGraph((current) => {
        const sourceNode = current.nodes.find((n) => n.id === sourceNodeId);
        if (!sourceNode) return current;

        const siblingCount = current.nodes.filter((n) => {
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

        let next = applyCanvasGraphCommand(current, {
          kind: 'append-persisted-marks',
          sourceNodeId,
          marks,
          color: hex,
          targetNodeId: nodeId,
        });
        next = applyCanvasGraphCommand(next, { kind: 'append-nodes', nodes: [newNode] });
        next = applyCanvasGraphCommand(next, { kind: 'add-edge', edge: newEdge });
        return next;
      });
    },
    []
  );

  const handleUpdateNote = useCallback(
    (nodeId: string, content: string) => {
      dispatch({ kind: 'patch-note-data', nodeId, patch: { content } });
    },
    [dispatch]
  );

  const handleAsk = useCallback(
    (sourceNodeId: string, prompt: string, marks: MarkPayload[], hex: string, fromText?: string) => {
      setGraph((current) => {
        const sourceNode = current.nodes.find((n) => n.id === sourceNodeId);
        if (!sourceNode) return current;

        const sourceData = sourceNode.data as QANodeData;
        const siblingCount = current.nodes.filter(
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

        let next = applyCanvasGraphCommand(current, {
          kind: 'append-persisted-marks',
          sourceNodeId,
          marks,
          color: hex,
          targetNodeId: nodeId,
        });
        next = applyCanvasGraphCommand(next, { kind: 'append-nodes', nodes: [newNode] });
        next = applyCanvasGraphCommand(next, { kind: 'add-edge', edge: newEdge });

        (async () => {
          try {
            const { response, keywords, title, followUpQuestions } = await explore({
              prompt,
              markedText,
              parentContext: sourceData.aiResponse
                ? { question: sourceData.userPrompt, answer: sourceData.aiResponse }
                : undefined,
            });
            dispatch({
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
            dispatch({
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

        return next;
      });
    },
    [dispatch]
  );

  const handleCreateDraftFollowUp = useCallback(
    (sourceNodeId: string, prompt: string, hex: string) => {
      setGraph((current) => {
        const sourceNode = current.nodes.find((n) => n.id === sourceNodeId);
        if (!sourceNode) return current;

        const siblingCount = current.nodes.filter(
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

        let next = applyCanvasGraphCommand(current, { kind: 'append-nodes', nodes: [newNode] });
        next = applyCanvasGraphCommand(next, { kind: 'add-edge', edge: newEdge });
        return next;
      });
    },
    []
  );

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

      dispatch({ kind: 'set-graph', nodes: [newNode], edges: [] });

      (async () => {
        try {
          const { response, keywords, title, followUpQuestions } = await explore({ prompt });
          dispatch({
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
          dispatch({
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
    [dispatch]
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
    if (window.confirm('Clear the entire canvas? This cannot be undone.')) {
      dispatch({ kind: 'set-graph', nodes: [], edges: [] });
      clearCanvas();
    }
  }, [dispatch]);

  const handleUpdateTitle = useCallback(
    (nodeId: string, newTitle: string) => {
      dispatch({ kind: 'patch-qa-data', nodeId, patch: { title: newTitle } });
    },
    [dispatch]
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
      dispatch({ kind: 'append-nodes', nodes: [newNode] });
    },
    [dispatch]
  );

  const handleSubmitRootPrompt = useCallback(
    (nodeId: string, prompt: string) => {
      const snap = graphRef.current;
      const targetNode = snap.nodes.find((n) => n.id === nodeId);
      if (!targetNode) return;
      const targetData = targetNode.data as QANodeData;
      const parentNode = targetData.parentId
        ? snap.nodes.find((n) => n.id === targetData.parentId)
        : undefined;
      const parentData = parentNode?.data as QANodeData | undefined;

      dispatch({
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
          dispatch({
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
          dispatch({
            kind: 'patch-qa-data',
            nodeId,
            patch: { isLoading: false, hasFailed: true },
          });
        }
      })();
    },
    [dispatch]
  );

  const handleRefreshFollowUps = useCallback(
    async (nodeId: string) => {
      const target = graphRef.current.nodes.find((n) => n.id === nodeId);
      if (!target) return;
      const nodeData = target.data as QANodeData;
      if (!nodeData.userPrompt || !nodeData.aiResponse) return;

      try {
        const { followUpQuestions } = await getFollowUpQuestions({
          question: nodeData.userPrompt,
          answer: nodeData.aiResponse,
        });
        dispatch({ kind: 'patch-qa-data', nodeId, patch: { followUpQuestions } });
      } catch (err) {
        console.error('Follow-up refresh failed:', err);
      }
    },
    [dispatch]
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

  const nodes = graph.nodes;

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

  return {
    nodes: nodesWithCallbacks,
    edges: graph.edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    initialPrompt,
    setInitialPrompt,
    sparkQuestion,
    handleInitialSubmit,
    handleClearCanvas,
    createNodeAt,
  };
}
