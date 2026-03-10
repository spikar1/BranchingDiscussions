'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { NoteNodeData } from '@/types/canvas';
import { tint, contrastText, darken } from '@/lib/colors';

export type NoteNodeCallbacks = {
  onDelete: (nodeId: string) => void;
  onUpdateNote: (nodeId: string, content: string) => void;
};

type NoteNodeProps = NodeProps & {
  data: NoteNodeData & NoteNodeCallbacks;
};

function NoteNode({ data }: NoteNodeProps) {
  const [editing, setEditing] = useState(!data.content);
  const [draft, setDraft] = useState(data.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hex = data.branchColor || '#fbbf24';

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(draft.length, draft.length);
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      data.onUpdateNote(data.id, trimmed);
      setEditing(false);
    }
  };

  return (
    <div className="relative group" style={{ minWidth: 200, width: '100%', height: '100%' }}>
      <NodeResizer
        minWidth={200}
        minHeight={80}
        lineClassName="!border-transparent group-hover:!border-amber-200"
        handleClassName="!w-2.5 !h-2.5 !bg-amber-400 !border-white !border-2 !rounded-sm !opacity-0 group-hover:!opacity-100 transition-opacity"
      />
      <div
        className="rounded-xl shadow-lg border-2 overflow-hidden h-full flex flex-col"
        style={{
          borderColor: hex,
          backgroundColor: tint(hex, 0.08),
        }}
      >
        <Handle type="target" position={Position.Top} />

        <div
          className="px-3 py-2 border-b flex items-center gap-2"
          style={{ backgroundColor: tint(hex, 0.2), borderColor: tint(hex, 0.15) }}
        >
          <svg className="w-3.5 h-3.5 shrink-0" style={{ color: darken(hex, 0.2) }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span
            className="text-xs font-semibold flex-1 truncate"
            style={{ color: darken(hex, 0.3) }}
          >
            Note
          </span>
          <button
            onClick={() => data.onDelete(data.id)}
            className="p-0.5 rounded transition-colors"
            style={{ color: darken(hex, 0.1) }}
            title="Delete note"
          >
            <svg className="w-3 h-3 hover:text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {editing ? (
          <div className="p-3 nodrag nopan flex-1 flex flex-col min-h-0">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
                if (e.key === 'Escape') {
                  if (data.content) {
                    setDraft(data.content);
                    setEditing(false);
                  }
                }
              }}
              placeholder="Write your note..."
              className="w-full flex-1 text-sm text-gray-800 bg-white/80 border rounded-lg px-3 py-2 resize-none
                         focus:outline-none focus:ring-2 min-h-[60px]"
              style={{
                borderColor: tint(hex, 0.3),
                // @ts-expect-error CSS custom property for focus ring
                '--tw-ring-color': hex,
              }}
            />
            <div className="flex justify-end gap-2 mt-2">
              {data.content && (
                <button
                  onClick={() => { setDraft(data.content); setEditing(false); }}
                  className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!draft.trim()}
                className="text-xs px-3 py-1 rounded font-medium disabled:opacity-40 transition-all"
                style={{ backgroundColor: hex, color: contrastText(hex) }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            className="px-3 py-3 cursor-pointer nodrag nopan flex-1 min-h-0 overflow-auto"
            onClick={() => { setDraft(data.content); setEditing(true); }}
            title="Click to edit"
          >
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {data.content}
            </p>
          </div>
        )}

        <Handle type="source" position={Position.Bottom} />
      </div>
    </div>
  );
}

export default memo(NoteNode);
