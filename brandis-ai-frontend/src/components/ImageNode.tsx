'use client';

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ImageNodeData } from '@/types/canvas';

export type ImageNodeCallbacks = {
  onDelete: (nodeId: string) => void;
};

type ImageNodeProps = NodeProps & {
  data: ImageNodeData & ImageNodeCallbacks & { isLoading?: boolean };
};

function ImageNode({ data }: ImageNodeProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative group">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
           style={{ width: expanded ? 520 : 260 }}>
        <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0 !min-w-0 !min-h-0" />

        <div className="bg-indigo-50 px-3 py-2 border-b border-indigo-100 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-xs font-medium text-indigo-800 flex-1 min-w-0 truncate">{data.prompt}</p>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1 text-indigo-400 hover:text-indigo-700 transition-colors rounded"
              title={expanded ? 'Shrink' : 'Enlarge'}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {expanded ? (
                  <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
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

        {data.isLoading ? (
          <div className="flex items-center justify-center py-12 text-indigo-300">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Generating...</span>
            </div>
          </div>
        ) : data.imageUrl ? (
          <div className="nodrag nopan">
            <img
              src={data.imageUrl}
              alt={data.prompt}
              className="w-full h-auto block"
              draggable={false}
            />
          </div>
        ) : null}

        <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0 !min-w-0 !min-h-0" />
      </div>
    </div>
  );
}

export default memo(ImageNode);
