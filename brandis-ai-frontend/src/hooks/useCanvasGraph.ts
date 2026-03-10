'use client';

import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import {
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';

import { type MarkPayload } from '@/components/QANode';
import { QANodeData, ImageNodeData, NoteNodeData, PersistedMark } from '@/types/canvas';
import { explore, imagine } from '@/lib/ai';
import { loadCanvas, debouncedSave, clearCanvas } from '@/lib/persistence';

const ARROW_MARKER = {
  type: MarkerType.ArrowClosed,
  width: 16,
  height: 16,
};

const RADIUS_BASE = 350;
const RADIUS_GROWTH = 80;

function generateId() {
  return `node-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function getChildAngle(childIndex: number, totalSiblings: number): number {
  if (totalSiblings === 1) return Math.PI / 2;
  const spread = Math.min(Math.PI * 1.6, (Math.PI / 3) * totalSiblings);
  const startAngle = (Math.PI / 2) - (spread / 2);
  const step = totalSiblings > 1 ? spread / (totalSiblings - 1) : 0;
  return startAngle + step * childIndex;
}

function findChildPosition(sourceNode: Node, existingSiblingCount: number): { x: number; y: number } {
  const radius = RADIUS_BASE + existingSiblingCount * RADIUS_GROWTH;
  const angle = getChildAngle(existingSiblingCount, existingSiblingCount + 1);
  return {
    x: sourceNode.position.x + Math.cos(angle) * radius,
    y: sourceNode.position.y + Math.sin(angle) * radius,
  };
}

export function useCanvasGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [initialPrompt, setInitialPrompt] = useState('');
  const [sparkQuestion, setSparkQuestion] = useState('');
  const hasRestored = useRef(false);

  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;
    const saved = loadCanvas();
    if (saved && saved.nodes.length > 0) {
      setNodes(saved.nodes);
      setEdges(saved.edges);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!hasRestored.current) return;
    if (nodes.length > 0) {
      debouncedSave(nodes, edges);
    }
  }, [nodes, edges]);

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
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === nodeId) {
            const nodeData = n.data as QANodeData;
            return {
              ...n,
              data: {
                ...n.data,
                persistedMarks: nodeData.persistedMarks.map((m) =>
                  m.targetNodeId === targetNodeId ? { ...m, color: newHex } : m
                ),
              },
            };
          }
          if (n.id === targetNodeId) {
            return { ...n, data: { ...n.data, branchColor: newHex } };
          }
          return n;
        })
      );
      setEdges((prev) =>
        prev.map((e) => {
          if (e.source === nodeId && e.target === targetNodeId) {
            return { ...e, style: { ...e.style, stroke: newHex }, markerEnd: { ...ARROW_MARKER, color: newHex } };
          }
          return e;
        })
      );
    },
    [setNodes, setEdges]
  );

  const handleNodeRecolor = useCallback(
    (nodeId: string, newHex: string) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          return { ...n, data: { ...n.data, branchColor: newHex } };
        })
      );
      setEdges((prev) =>
        prev.map((e) => {
          if (e.target === nodeId) {
            return { ...e, style: { ...e.style, stroke: newHex }, markerEnd: { ...ARROW_MARKER, color: newHex } };
          }
          return e;
        })
      );
      setNodes((prev) =>
        prev.map((n) => {
          if (n.type !== 'qa') return n;
          const nd = n.data as QANodeData;
          const hasMatch = nd.persistedMarks?.some((m) => m.targetNodeId === nodeId);
          if (!hasMatch) return n;
          return {
            ...n,
            data: {
              ...n.data,
              persistedMarks: nd.persistedMarks.map((m) =>
                m.targetNodeId === nodeId ? { ...m, color: newHex } : m
              ),
            },
          };
        })
      );
    },
    [setNodes, setEdges]
  );

  const handleDelete = useCallback(
    (nodeId: string) => {
      setNodes((prev) => {
        return prev
          .filter((n) => n.id !== nodeId)
          .map((n) => {
            if (n.type !== 'qa') return n;
            const nodeData = n.data as QANodeData;
            if (nodeData.persistedMarks?.some((m) => m.targetNodeId === nodeId)) {
              return {
                ...n,
                data: {
                  ...n.data,
                  persistedMarks: nodeData.persistedMarks.filter((m) => m.targetNodeId !== nodeId),
                },
              };
            }
            return n;
          });
      });
      setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges]
  );

  const handleExpand = useCallback(
    (nodeId: string) => {
      setNodes((prev) => {
        const node = prev.find((n) => n.id === nodeId);
        if (!node) return prev;

        const nodeData = node.data as QANodeData;
        const parentNode = nodeData.parentId
          ? prev.find((n) => n.id === nodeData.parentId)
          : undefined;
        const parentData = parentNode?.data as QANodeData | undefined;

        const updated = prev.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, isExpanding: true } } : n
        );

        (async () => {
          try {
            const { response, keywords } = await explore({
              prompt: nodeData.userPrompt,
              markedText: nodeData.branchedFromText ?? undefined,
              parentContext: parentData?.aiResponse
                ? { question: parentData.userPrompt, answer: parentData.aiResponse }
                : undefined,
              expand: true,
              currentAnswer: nodeData.aiResponse,
            });
            setNodes((p) =>
              p.map((n) => {
                if (n.id !== nodeId) return n;
                return {
                  ...n,
                  data: {
                    ...n.data,
                    aiResponse: response,
                    keywords,
                    persistedMarks: [],
                    isExpanding: false,
                  },
                };
              })
            );
          } catch (err) {
            console.error('Expand failed:', err);
            setNodes((p) =>
              p.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, isExpanding: false } } : n
              )
            );
          }
        })();

        return updated;
      });
    },
    [setNodes]
  );

  const handleRetry = useCallback(
    (nodeId: string) => {
      setNodes((prev) => {
        const node = prev.find((n) => n.id === nodeId);
        if (!node) return prev;

        const nodeData = node.data as QANodeData;
        const parentNode = nodeData.parentId
          ? prev.find((n) => n.id === nodeData.parentId)
          : undefined;
        const parentData = parentNode?.data as QANodeData | undefined;

        const updated = prev.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, isLoading: true, hasFailed: false, aiResponse: '' } }
            : n
        );

        (async () => {
          try {
            const { response, keywords, title } = await explore({
              prompt: nodeData.userPrompt,
              markedText: nodeData.branchedFromText ?? undefined,
              parentContext: parentData?.aiResponse
                ? { question: parentData.userPrompt, answer: parentData.aiResponse }
                : undefined,
            });
            setNodes((p) =>
              p.map((n) => {
                if (n.id !== nodeId) return n;
                const existing = n.data as QANodeData;
                return {
                  ...n,
                  data: { ...n.data, aiResponse: response, keywords, title: existing.title || title, isLoading: false },
                };
              })
            );
          } catch (err) {
            console.error('Retry failed:', err);
            setNodes((p) =>
              p.map((n) => {
                if (n.id !== nodeId) return n;
                return {
                  ...n,
                  data: {
                    ...n.data,
                    aiResponse: 'Something went wrong.',
                    keywords: [],
                    isLoading: false,
                    hasFailed: true,
                  },
                };
              })
            );
          }
        })();

        return updated;
      });
    },
    [setNodes]
  );

  const handleRegenerateImage = useCallback(
    (imgNodeId: string, newPrompt: string) => {
      let capturedContext = '';

      setNodes((prev) => {
        const node = prev.find((n) => n.id === imgNodeId);
        if (!node) return prev;
        capturedContext = (node.data as ImageNodeData).context ?? '';

        return prev.map((n) => {
          if (n.id !== imgNodeId) return n;
          return { ...n, data: { ...n.data, prompt: newPrompt, isLoading: true } };
        });
      });

      (async () => {
        try {
          const { imageUrl, title } = await imagine({ prompt: newPrompt, context: capturedContext || undefined });
          setNodes((prev) =>
            prev.map((n) => {
              if (n.id !== imgNodeId) return n;
              const nd = n.data as ImageNodeData;
              return {
                ...n,
                data: {
                  ...n.data,
                  imageUrl,
                  title,
                  images: [{ prompt: newPrompt, title, url: imageUrl }, ...nd.images],
                  isLoading: false,
                },
              };
            })
          );
        } catch (err) {
          console.error('Image regeneration failed:', err);
          setNodes((prev) =>
            prev.map((n) =>
              n.id === imgNodeId ? { ...n, data: { ...n.data, isLoading: false } } : n
            )
          );
        }
      })();
    },
    [setNodes]
  );

  const handleSelectImage = useCallback(
    (imgNodeId: string, url: string) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== imgNodeId) return n;
          const nd = n.data as ImageNodeData;
          const entry = nd.images.find((img) => img.url === url);
          return {
            ...n,
            data: {
              ...n.data,
              imageUrl: url,
              title: entry?.title ?? nd.title,
              prompt: entry?.prompt ?? nd.prompt,
            },
          };
        })
      );
    },
    [setNodes]
  );

  const handleImagine = useCallback(
    (nodeId: string, prompt: string, context: string) => {
      setNodes((currentNodes) => {
        const sourceNode = currentNodes.find((n) => n.id === nodeId);
        if (!sourceNode) return currentNodes;

        const siblingCount = currentNodes.filter((n) => {
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

        const newNode: Node = {
          id: imgNodeId,
          type: 'image',
          position,
          style: { width: 280 },
          data: { ...imgData, isLoading: true },
        };

        const newEdge: Edge = {
          id: `edge-${nodeId}-${imgNodeId}`,
          source: nodeId,
          target: imgNodeId,
          type: 'floating',
          style: { stroke: '#818cf8', strokeWidth: 2, strokeDasharray: '6 3' },
          markerEnd: { ...ARROW_MARKER, color: '#818cf8' },
        };

        setEdges((prev) => [...prev, newEdge]);

        (async () => {
          try {
            const { imageUrl, title } = await imagine({ prompt, context: context || undefined });
            setNodes((prev) =>
              prev.map((n) => {
                if (n.id !== imgNodeId) return n;
                return {
                  ...n,
                  data: {
                    ...n.data,
                    imageUrl,
                    title,
                    images: [{ prompt, title, url: imageUrl }],
                    isLoading: false,
                  },
                };
              })
            );
          } catch (err) {
            console.error('Image generation failed:', err);
            setNodes((prev) => prev.filter((n) => n.id !== imgNodeId));
            setEdges((prev) => prev.filter((e) => e.target !== imgNodeId));
          }
        })();

        return [...currentNodes, newNode];
      });
    },
    [setNodes, setEdges]
  );

  const handleNote = useCallback(
    (sourceNodeId: string, marks: MarkPayload[], hex: string, fromText?: string) => {
      setNodes((currentNodes) => {
        const sourceNode = currentNodes.find((n) => n.id === sourceNodeId);
        if (!sourceNode) return currentNodes;

        const siblingCount = currentNodes.filter((n) => {
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

        const newNode: Node = {
          id: nodeId,
          type: 'note',
          position,
          style: { width: 280 },
          data: noteData,
        };

        const newEdge: Edge = {
          id: `edge-${sourceNodeId}-${nodeId}`,
          source: sourceNodeId,
          target: nodeId,
          type: 'floating',
          style: { stroke: hex, strokeWidth: 2, strokeDasharray: '4 4' },
          markerEnd: { ...ARROW_MARKER, color: hex },
          data: { label: fromText || 'Note' },
        };

        setEdges((prev) => [...prev, newEdge]);

        const hasMarks = marks.length > 0;
        const updatedNodes = hasMarks
          ? currentNodes.map((n) => {
              if (n.id !== sourceNodeId) return n;
              const existingMarks = (n.data as QANodeData).persistedMarks ?? [];
              const newPersistedMarks: PersistedMark[] = marks.map((m) => ({
                text: m.text,
                startIndex: m.startIndex,
                endIndex: m.endIndex,
                color: hex,
                targetNodeId: nodeId,
              }));
              return {
                ...n,
                data: { ...n.data, persistedMarks: [...existingMarks, ...newPersistedMarks] },
              };
            })
          : currentNodes;

        return [...updatedNodes, newNode];
      });
    },
    [setNodes, setEdges]
  );

  const handleUpdateNote = useCallback(
    (nodeId: string, content: string) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          return { ...n, data: { ...n.data, content } };
        })
      );
    },
    [setNodes]
  );

  const handleAsk = useCallback(
    (sourceNodeId: string, prompt: string, marks: MarkPayload[], hex: string, fromText?: string) => {
      setNodes((currentNodes) => {
        const sourceNode = currentNodes.find((n) => n.id === sourceNodeId);
        if (!sourceNode) return currentNodes;

        const sourceData = sourceNode.data as QANodeData;
        const siblingCount = currentNodes.filter(
          (n) => (n.data as QANodeData).parentId === sourceNodeId
        ).length;

        const position = findChildPosition(sourceNode, siblingCount);
        const nodeId = generateId();
        const markedText = fromText || undefined;

        const nodeData: QANodeData = {
          id: nodeId,
          title: '',
          userPrompt: prompt,
          aiResponse: '',
          keywords: [],
          persistedMarks: [],
          parentId: sourceNodeId,
          branchedFromId: fromText ? sourceNodeId : null,
          branchedFromText: fromText ?? null,
          branchColor: hex,
          createdAt: new Date(),
        };

        const newNode: Node = {
          id: nodeId,
          type: 'qa',
          position,
          style: { width: 380 },
          data: { ...nodeData, isLoading: true },
        };

        const newEdge: Edge = {
          id: `edge-${sourceNodeId}-${nodeId}`,
          source: sourceNodeId,
          target: nodeId,
          type: 'floating',
          style: { stroke: hex, strokeWidth: 2 },
          markerEnd: { ...ARROW_MARKER, color: hex },
          data: { label: fromText || prompt },
        };

        setEdges((prev) => [...prev, newEdge]);

        const hasMarks = marks.length > 0;
        const updatedNodes = hasMarks
          ? currentNodes.map((n) => {
              if (n.id !== sourceNodeId) return n;
              const existingMarks = (n.data as QANodeData).persistedMarks ?? [];
              const newPersistedMarks: PersistedMark[] = marks.map((m) => ({
                text: m.text,
                startIndex: m.startIndex,
                endIndex: m.endIndex,
                color: hex,
                targetNodeId: nodeId,
              }));
              return {
                ...n,
                data: { ...n.data, persistedMarks: [...existingMarks, ...newPersistedMarks] },
              };
            })
          : currentNodes;

        (async () => {
          try {
            const { response, keywords, title } = await explore({
              prompt,
              markedText,
              parentContext: sourceData.aiResponse
                ? { question: sourceData.userPrompt, answer: sourceData.aiResponse }
                : undefined,
            });
            setNodes((prev) =>
              prev.map((n) => {
                if (n.id !== nodeId) return n;
                return {
                  ...n,
                  data: { ...n.data, aiResponse: response, keywords, title: title || prompt, isLoading: false },
                };
              })
            );
          } catch (err) {
            console.error('AI request failed:', err);
            setNodes((prev) =>
              prev.map((n) => {
                if (n.id !== nodeId) return n;
                return {
                  ...n,
                  data: {
                    ...n.data,
                    aiResponse: 'Something went wrong.',
                    keywords: [],
                    isLoading: false,
                    hasFailed: true,
                  },
                };
              })
            );
          }
        })();

        return [...updatedNodes, newNode];
      });
    },
    [setNodes, setEdges]
  );

  const createRootNode = useCallback(
    (prompt: string) => {
      const nodeId = generateId();

      const nodeData: QANodeData = {
        id: nodeId,
        title: '',
        userPrompt: prompt,
        aiResponse: '',
        keywords: [],
        persistedMarks: [],
        parentId: null,
        branchedFromId: null,
        branchedFromText: null,
        branchColor: null,
        createdAt: new Date(),
      };

      const newNode: Node = {
        id: nodeId,
        type: 'qa',
        position: { x: 0, y: 0 },
        style: { width: 380 },
        data: { ...nodeData, isLoading: true },
      };

      setNodes([newNode]);
      setEdges([]);

      (async () => {
        try {
          const { response, keywords, title } = await explore({ prompt });
          setNodes((prev) =>
            prev.map((n) => {
              if (n.id !== nodeId) return n;
              return {
                ...n,
                data: { ...n.data, aiResponse: response, keywords, title: title || prompt, isLoading: false },
              };
            })
          );
        } catch (err) {
          console.error('AI request failed:', err);
          setNodes((prev) =>
            prev.map((n) => {
              if (n.id !== nodeId) return n;
              return {
                ...n,
                data: {
                  ...n.data,
                  aiResponse: 'Something went wrong.',
                  keywords: [],
                  isLoading: false,
                  hasFailed: true,
                },
              };
            })
          );
        }
      })();
    },
    [setNodes, setEdges]
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
      setNodes([]);
      setEdges([]);
      clearCanvas();
    }
  }, [setNodes, setEdges]);

  const handleUpdateTitle = useCallback(
    (nodeId: string, newTitle: string) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          return { ...n, data: { ...n.data, title: newTitle } };
        })
      );
    },
    [setNodes]
  );

  const createNodeAt = useCallback(
    (position: { x: number; y: number }) => {
      const nodeId = generateId();
      const nodeData: QANodeData = {
        id: nodeId,
        title: '',
        userPrompt: '',
        aiResponse: '',
        keywords: [],
        persistedMarks: [],
        parentId: null,
        branchedFromId: null,
        branchedFromText: null,
        branchColor: null,
        createdAt: new Date(),
      };
      const newNode: Node = {
        id: nodeId,
        type: 'qa',
        position,
        style: { width: 380 },
        data: { ...nodeData, isAwaitingPrompt: true },
      };
      setNodes((prev) => [...prev, newNode]);
    },
    [setNodes]
  );

  const handleSubmitRootPrompt = useCallback(
    (nodeId: string, prompt: string) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          return {
            ...n,
            data: { ...n.data, userPrompt: prompt, isLoading: true, isAwaitingPrompt: false },
          };
        })
      );

      (async () => {
        try {
          const { response, keywords, title } = await explore({ prompt });
          setNodes((prev) =>
            prev.map((n) => {
              if (n.id !== nodeId) return n;
              return {
                ...n,
                data: { ...n.data, aiResponse: response, keywords, title: title || prompt, isLoading: false },
              };
            })
          );
        } catch (err) {
          console.error('Root prompt failed:', err);
          setNodes((prev) =>
            prev.map((n) => {
              if (n.id !== nodeId) return n;
              return {
                ...n,
                data: { ...n.data, isLoading: false, hasFailed: true },
              };
            })
          );
        }
      })();
    },
    [setNodes]
  );

  const qaCallbacks = useMemo(() => ({
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
  }), [handleAsk, handleRecolor, handleNodeRecolor, handleExpand, handleImagine, handleDelete, handleRetry, handleNote, handleUpdateTitle, handleSubmitRootPrompt]);

  const imageCallbacks = useMemo(() => ({
    onDelete: handleDelete,
    onRegenerate: handleRegenerateImage,
    onSelectImage: handleSelectImage,
  }), [handleDelete, handleRegenerateImage, handleSelectImage]);

  const noteCallbacks = useMemo(() => ({
    onDelete: handleDelete,
    onUpdateNote: handleUpdateNote,
  }), [handleDelete, handleUpdateNote]);

  const nodesWithCallbacks = useMemo(() =>
    nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        ...(n.type === 'qa' ? qaCallbacks : n.type === 'image' ? imageCallbacks : n.type === 'note' ? noteCallbacks : { onDelete: handleDelete }),
      },
    })),
    [nodes, qaCallbacks, imageCallbacks, noteCallbacks, handleDelete]
  );

  return {
    nodes: nodesWithCallbacks,
    edges,
    setEdges,
    onNodesChange,
    onEdgesChange,
    initialPrompt,
    setInitialPrompt,
    sparkQuestion,
    handleInitialSubmit,
    handleClearCanvas,
    createNodeAt,
  };
}
