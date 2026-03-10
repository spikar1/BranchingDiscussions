'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';
import { QANodeData, ImageNodeData, NoteNodeData } from '@/types/canvas';

export default function NodeSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { getNodes, fitView } = useReactFlow();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useCallback(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    const nodes = getNodes();
    return nodes.filter((n: Node) => {
      if (n.type === 'qa') {
        const d = n.data as QANodeData;
        return (
          d.title?.toLowerCase().includes(lower) ||
          d.userPrompt?.toLowerCase().includes(lower) ||
          d.aiResponse?.toLowerCase().includes(lower)
        );
      }
      if (n.type === 'image') {
        const d = n.data as ImageNodeData;
        return d.prompt?.toLowerCase().includes(lower);
      }
      if (n.type === 'note') {
        const d = n.data as NoteNodeData;
        return d.content?.toLowerCase().includes(lower);
      }
      return false;
    });
  }, [query, getNodes]);

  const handleSelect = (nodeId: string) => {
    fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.5 });
    setOpen(false);
  };

  if (!open) return null;

  const matches = results();

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-gray-100 gap-3">
          <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes..."
            className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-transparent"
          />
          <kbd className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
            ESC
          </kbd>
        </div>

        {query.trim() && (
          <div className="max-h-64 overflow-y-auto">
            {matches.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                No matching nodes found
              </div>
            ) : (
              matches.map((n: Node) => {
                const isQA = n.type === 'qa';
                const isNote = n.type === 'note';
                const d = n.data as QANodeData | ImageNodeData | NoteNodeData;
                const qaData = d as QANodeData;
                const title = isQA
                  ? (qaData.title || qaData.userPrompt)
                  : isNote
                    ? (d as NoteNodeData).content.substring(0, 60)
                    : (d as ImageNodeData).prompt;
                const subtitle = isQA ? (d as QANodeData).aiResponse?.substring(0, 80) : undefined;

                return (
                  <button
                    key={n.id}
                    onClick={() => handleSelect(n.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                        {isQA ? 'Q&A' : isNote ? 'Note' : 'Image'}
                      </span>
                      <span className="text-sm text-gray-900 truncate">{title}</span>
                    </div>
                    {subtitle && (
                      <p className="text-xs text-gray-400 truncate mt-0.5 ml-8">{subtitle}</p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
