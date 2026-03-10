'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { ImageNodeData } from '@/types/canvas';

export type ImageNodeCallbacks = {
  onDelete: (nodeId: string) => void;
  onRegenerate: (nodeId: string, prompt: string) => void;
  onSelectImage: (nodeId: string, url: string) => void;
};

type ImageNodeProps = NodeProps & {
  data: ImageNodeData & ImageNodeCallbacks & { isLoading?: boolean };
};

function ImageNode({ data }: ImageNodeProps) {
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState(data.prompt);

  const displayTitle = data.title || data.prompt;

  const handleRegenerate = () => {
    const prompt = editPrompt.trim() || data.prompt;
    data.onRegenerate(data.id, prompt);
    setEditing(false);
  };

  return (
    <div className="relative group" style={{ minWidth: 200, width: '100%', height: '100%' }}>
      <NodeResizer
        minWidth={200}
        minHeight={100}
        lineClassName="!border-transparent group-hover:!border-indigo-200"
        handleClassName="!w-2.5 !h-2.5 !bg-indigo-400 !border-white !border-2 !rounded-sm !opacity-0 group-hover:!opacity-100 transition-opacity"
      />
      <div
        className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden h-full flex flex-col"
      >
        <Handle type="target" position={Position.Top} />

        {/* Header */}
        <div className="bg-indigo-50 px-3 py-2 border-b border-indigo-100 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-xs font-medium text-indigo-800 flex-1 min-w-0 truncate">
            {displayTitle}
          </p>
          <div className="flex items-center gap-0.5 shrink-0">
            {editing && (
              <button
                onClick={handleRegenerate}
                className="p-1 text-indigo-500 hover:text-indigo-700 transition-colors rounded"
                title="Regenerate with new prompt"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <button
              onClick={() => data.onDelete(data.id)}
              className="p-1 text-indigo-400 hover:text-red-500 transition-colors rounded"
              title="Remove image"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Prompt editor (shown when editing) */}
        {editing && (
          <div className="px-3 py-2 bg-indigo-50/50 border-b border-indigo-100">
            <label className="text-[10px] uppercase tracking-wider text-indigo-400 font-medium mb-1 block">Prompt</label>
            <input
              type="text"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRegenerate();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-full text-xs text-indigo-800 bg-white border border-indigo-200
                         rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 nodrag nopan"
              autoFocus
            />
          </div>
        )}

        {/* Main image */}
        {data.isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12 text-indigo-300">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Generating...</span>
            </div>
          </div>
        ) : data.imageUrl ? (
          <div className="nodrag nopan flex-1 min-h-0 overflow-hidden">
            <img
              src={data.imageUrl}
              alt={displayTitle}
              className="w-full h-full object-contain block"
              draggable={false}
            />
          </div>
        ) : null}

        {/* Regenerate bar (visible when not editing) */}
        {!data.isLoading && data.imageUrl && !editing && (
          <div className="px-3 py-1.5 border-t border-indigo-100 flex justify-end">
            <button
              onClick={() => { setEditing(true); setEditPrompt(data.prompt); }}
              className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Edit &amp; Regenerate
            </button>
          </div>
        )}

        {/* History thumbnails */}
        {data.images.length > 1 && !data.isLoading && (
          <div className="px-2 py-2 border-t border-indigo-100 nodrag nopan">
            <div className="flex gap-1.5 overflow-x-auto">
              {data.images.map((img, i) => (
                <button
                  key={`${img.url}-${i}`}
                  onClick={() => data.onSelectImage(data.id, img.url)}
                  className={`shrink-0 rounded overflow-hidden border-2 transition-all
                              ${img.url === data.imageUrl ? 'border-indigo-500 shadow-sm' : 'border-transparent hover:border-indigo-300 opacity-60 hover:opacity-100'}`}
                  title={img.prompt}
                  style={{ width: 48, height: 48 }}
                >
                  <img
                    src={img.url}
                    alt={img.prompt}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <Handle type="source" position={Position.Bottom} />
      </div>
    </div>
  );
}

export default memo(ImageNode);
