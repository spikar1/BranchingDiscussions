'use client';

import { useCallback, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import QANode, { type MarkPayload } from './QANode';
import ImageNode from './ImageNode';
import FloatingEdge from './FloatingEdge';
import { QANodeData, ImageNodeData, PersistedMark } from '@/types/canvas';
import { getColorById } from '@/lib/colors';
import { explore, imagine } from '@/lib/ai';

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

export default function ExplorationCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [initialPrompt, setInitialPrompt] = useState('');

  const nodeTypes = useMemo(() => ({ qa: QANode, image: ImageNode }), []);
  const edgeTypes = useMemo(() => ({ floating: FloatingEdge }), []);

  const handleRecolor = useCallback(
    (nodeId: string, targetNodeId: string, newColorId: string) => {
      const newEdgeColor = getColorById(newColorId).edge;

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === nodeId) {
            const nodeData = n.data as QANodeData;
            return {
              ...n,
              data: {
                ...n.data,
                persistedMarks: nodeData.persistedMarks.map((m) =>
                  m.targetNodeId === targetNodeId ? { ...m, color: newColorId } : m
                ),
              },
            };
          }
          if (n.id === targetNodeId) {
            return {
              ...n,
              data: { ...n.data, branchColor: newColorId },
            };
          }
          return n;
        })
      );

      setEdges((prev) =>
        prev.map((e) => {
          if (e.source === nodeId && e.target === targetNodeId) {
            return { ...e, style: { ...e.style, stroke: newEdgeColor } };
          }
          return e;
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

        // Mark as expanding
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

  const handleImagine = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) => {
        const sourceNode = currentNodes.find((n) => n.id === nodeId);
        if (!sourceNode) return currentNodes;

        const sourceData = sourceNode.data as QANodeData;
        const siblingCount = currentNodes.filter(
          (n) => {
            const d = n.data as QANodeData | ImageNodeData;
            return d.parentId === nodeId;
          }
        ).length;

        const position = findChildPosition(sourceNode, siblingCount);
        const imgNodeId = generateId();
        const concept = sourceData.userPrompt;
        const context = sourceData.aiResponse
          ? sourceData.aiResponse.substring(0, 200)
          : undefined;

        const imgData: ImageNodeData = {
          id: imgNodeId,
          parentId: nodeId,
          prompt: concept,
          imageUrl: '',
          createdAt: new Date(),
        };

        const newNode: Node = {
          id: imgNodeId,
          type: 'image',
          position,
          data: { ...imgData, isLoading: true, onDelete: handleDelete },
        };

        const newEdge: Edge = {
          id: `edge-${nodeId}-${imgNodeId}`,
          source: nodeId,
          target: imgNodeId,
          type: 'floating',
          style: { stroke: '#818cf8', strokeWidth: 2, strokeDasharray: '6 3' },
        };

        setEdges((prev) => [...prev, newEdge]);

        (async () => {
          try {
            const { imageUrl } = await imagine({ concept, context });
            setNodes((prev) =>
              prev.map((n) => {
                if (n.id !== imgNodeId) return n;
                return {
                  ...n,
                  data: { ...n.data, imageUrl, isLoading: false },
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
    [setNodes, setEdges, handleDelete]
  );

  const handleAsk = useCallback(
    (sourceNodeId: string, prompt: string, marks: MarkPayload[], colorId: string, fromText?: string) => {
      setNodes((currentNodes) => {
        const sourceNode = currentNodes.find((n) => n.id === sourceNodeId);
        if (!sourceNode) return currentNodes;

        const sourceData = sourceNode.data as QANodeData;
        const siblingCount = currentNodes.filter(
          (n) => (n.data as QANodeData).parentId === sourceNodeId
        ).length;

        const position = findChildPosition(sourceNode, siblingCount);
        const nodeId = generateId();
        const edgeColor = getColorById(colorId).edge;
        const markedText = fromText || undefined;

        const nodeData: QANodeData = {
          id: nodeId,
          userPrompt: prompt,
          aiResponse: '',
          keywords: [],
          persistedMarks: [],
          parentId: sourceNodeId,
          branchedFromId: fromText ? sourceNodeId : null,
          branchedFromText: fromText ?? null,
          branchColor: colorId,
          createdAt: new Date(),
        };

        const newNode: Node = {
          id: nodeId,
          type: 'qa',
          position,
          data: { ...nodeData, isLoading: true, onAsk: handleAsk, onRecolor: handleRecolor, onDelete: handleDelete, onExpand: handleExpand, onImagine: handleImagine },
        };

        const newEdge: Edge = {
          id: `edge-${sourceNodeId}-${nodeId}`,
          source: sourceNodeId,
          target: nodeId,
          type: 'floating',
          style: { stroke: edgeColor, strokeWidth: 2 },
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
                color: colorId,
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
            const { response, keywords } = await explore({
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
                  data: { ...n.data, aiResponse: response, keywords, isLoading: false },
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
                    aiResponse: 'Something went wrong — try again.',
                    keywords: [],
                    isLoading: false,
                  },
                };
              })
            );
          }
        })();

        return [...updatedNodes, newNode];
      });
    },
    [setNodes, setEdges, handleRecolor, handleDelete, handleExpand, handleImagine]
  );

  const createRootNode = useCallback(
    (prompt: string) => {
      const nodeId = generateId();

      const nodeData: QANodeData = {
        id: nodeId,
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
        data: { ...nodeData, isLoading: true, onAsk: handleAsk, onRecolor: handleRecolor, onDelete: handleDelete, onExpand: handleExpand, onImagine: handleImagine },
      };

      setNodes([newNode]);
      setEdges([]);

      (async () => {
        try {
          const { response, keywords } = await explore({ prompt });
          setNodes((prev) =>
            prev.map((n) => {
              if (n.id !== nodeId) return n;
              return {
                ...n,
                data: { ...n.data, aiResponse: response, keywords, isLoading: false },
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
                  aiResponse: 'Something went wrong — try again.',
                  keywords: [],
                  isLoading: false,
                },
              };
            })
          );
        }
      })();
    },
    [handleAsk, handleRecolor, handleDelete, handleExpand, handleImagine, setNodes, setEdges]
  );

  const handleInitialSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!initialPrompt.trim()) return;
      createRootNode(initialPrompt);
      setInitialPrompt('');
    },
    [initialPrompt, createRootNode]
  );

  return (
    <div className="w-screen h-screen">
      <ReactFlow
        nodes={nodes.map((n) => ({
          ...n,
          data: {
            ...n.data,
            ...(n.type === 'qa' ? { onAsk: handleAsk, onRecolor: handleRecolor, onExpand: handleExpand, onImagine: handleImagine } : {}),
            onDelete: handleDelete,
          },
        }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'floating' }}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#d1d5db" />
        <Controls className="!bg-white !border-gray-200 !shadow-lg !rounded-lg" />
        <MiniMap
          className="!bg-white !border-gray-200 !shadow-lg !rounded-lg"
          nodeColor="#e2e8f0"
          maskColor="rgba(0, 0, 0, 0.06)"
        />

        {nodes.length === 0 && (
          <Panel position="top-center" className="!mt-[30vh]">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-lg">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Explore an idea
              </h1>
              <p className="text-gray-500 mb-6">
                Ask a question to start. Select any text to mark it and branch out into new explorations.
              </p>
              <form onSubmit={handleInitialSubmit} className="flex gap-3">
                <input
                  type="text"
                  value={initialPrompt}
                  onChange={(e) => setInitialPrompt(e.target.value)}
                  placeholder="What is Java?"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 bg-white
                             text-gray-900 placeholder:text-gray-400
                             focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent
                             text-base"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!initialPrompt.trim()}
                  className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium
                             hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed
                             transition-colors text-base"
                >
                  Explore
                </button>
              </form>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
