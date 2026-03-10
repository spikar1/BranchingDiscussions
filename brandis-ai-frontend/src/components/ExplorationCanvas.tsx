'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Panel,
  MarkerType,
  addEdge,
  useReactFlow,
  type Connection,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import QANode from './QANode';
import ImageNode from './ImageNode';
import NoteNode from './NoteNode';
import FloatingEdge from './FloatingEdge';
import NodeSearch from './NodeSearch';
import { useCanvasGraph } from '@/hooks/useCanvasGraph';

export default function ExplorationCanvas() {
  const {
    nodes,
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
  } = useCanvasGraph();

  const { screenToFlowPosition } = useReactFlow();

  const nodeTypes = useMemo(() => ({ qa: QANode, image: ImageNode, note: NoteNode }), []);
  const edgeTypes = useMemo(() => ({ floating: FloatingEdge }), []);

  const defaultEdgeOptions = useMemo(() => ({
    type: 'floating' as const,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94a3b8' },
  }), []);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    if (event.detail === 2) {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      createNodeAt(position);
    }
  }, [screenToFlowPosition, createNodeAt]);

  const onConnect = useCallback((connection: Connection) => {
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
    setEdges((prev) => addEdge(newEdge, prev));
  }, [setEdges]);

  return (
    <div className="w-screen h-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        zoomOnDoubleClick={false}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        deleteKeyCode="Delete"
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

        {nodes.length > 0 && (
          <Panel position="top-right">
            <div className="flex gap-2">
              <button
                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                className="px-3 py-1.5 bg-white/90 backdrop-blur text-xs text-gray-500 hover:text-gray-700 rounded-lg shadow border border-gray-200 transition-colors flex items-center gap-1.5"
                title="Search nodes (Ctrl+K)"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                </svg>
                Search
              </button>
              <button
                onClick={handleClearCanvas}
                className="px-3 py-1.5 bg-white/90 backdrop-blur text-xs text-gray-500 hover:text-red-600 rounded-lg shadow border border-gray-200 transition-colors"
              >
                Clear canvas
              </button>
            </div>
          </Panel>
        )}

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
                  placeholder={sparkQuestion || 'Ask anything...'}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 bg-white
                             text-gray-900 placeholder:text-gray-400
                             focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent
                             text-base"
                  autoFocus
                />
                <button
                  type="submit"
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
      <NodeSearch />
    </div>
  );
}
