'use client';

import { memo, useCallback, useState, useRef } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { QANodeData, SuggestedKeyword, PersistedMark } from '@/types/canvas';
import { getNextHex, tint, contrastText, darken } from '@/lib/colors';
import ColorPicker from './ColorPicker';

export type MarkPayload = {
  text: string;
  startIndex: number;
  endIndex: number;
};

export type QANodeCallbacks = {
  onAsk: (
    sourceNodeId: string,
    prompt: string,
    marks: MarkPayload[],
    hex: string,
    fromText?: string
  ) => void;
  onRecolor: (nodeId: string, targetNodeId: string, newHex: string) => void;
  onNodeRecolor: (nodeId: string, newHex: string) => void;
  onDelete: (nodeId: string) => void;
  onExpand: (nodeId: string) => void;
  onImagine: (nodeId: string, prompt: string, context: string) => void;
  onRetry: (nodeId: string) => void;
  onNote: (sourceNodeId: string, marks: MarkPayload[], hex: string, fromText?: string) => void;
  onUpdateTitle: (nodeId: string, newTitle: string) => void;
  onSubmitRootPrompt?: (nodeId: string, prompt: string) => void;
};

type QANodeProps = NodeProps & {
  data: QANodeData & QANodeCallbacks & {
    isLoading?: boolean;
    isExpanding?: boolean;
    hasFailed?: boolean;
    isAwaitingPrompt?: boolean;
  };
};

type ActiveMark = {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
};

type Span = {
  start: number;
  end: number;
  type: 'plain' | 'keyword' | 'persisted' | 'active';
  hex?: string;
  targetNodeId?: string;
};

function buildSpans(
  textLength: number,
  keywords: SuggestedKeyword[],
  persistedMarks: PersistedMark[],
  activeMarks: ActiveMark[],
  activeHex: string
): Span[] {
  const points = new Set<number>();
  points.add(0);
  points.add(textLength);

  type Region = {
    start: number; end: number;
    type: 'keyword' | 'persisted' | 'active';
    hex?: string; targetNodeId?: string; priority: number;
  };
  const regions: Region[] = [];

  for (const kw of keywords) {
    points.add(kw.startIndex);
    points.add(kw.endIndex);
    regions.push({ start: kw.startIndex, end: kw.endIndex, type: 'keyword', hex: kw.hex, priority: 0 });
  }
  for (const m of persistedMarks) {
    points.add(m.startIndex);
    points.add(m.endIndex);
    regions.push({
      start: m.startIndex, end: m.endIndex, type: 'persisted',
      hex: m.color, targetNodeId: m.targetNodeId, priority: 2,
    });
  }
  for (const m of activeMarks) {
    points.add(m.startIndex);
    points.add(m.endIndex);
    regions.push({ start: m.startIndex, end: m.endIndex, type: 'active', hex: activeHex, priority: 1 });
  }

  const sorted = Array.from(points).sort((a, b) => a - b);
  const spans: Span[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;

    const covering = regions
      .filter((r) => r.start <= start && r.end >= end)
      .sort((a, b) => b.priority - a.priority);

    if (covering.length > 0) {
      const top = covering[0];
      spans.push({ start, end, type: top.type, hex: top.hex, targetNodeId: top.targetNodeId });
    } else {
      spans.push({ start, end, type: 'plain' });
    }
  }

  return spans;
}

type ProseBlock =
  | { type: 'paragraph'; text: string; offset: number }
  | { type: 'list'; items: { text: string; offset: number }[] };

const LIST_RE = /^(?:[-*]|\d+[.)]) /;

function splitProseBlocks(text: string): ProseBlock[] {
  const lines = text.split('\n');
  const blocks: ProseBlock[] = [];
  let pos = 0;

  let currentList: { text: string; offset: number }[] | null = null;

  for (const line of lines) {
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (LIST_RE.test(trimmed)) {
      const bulletLen = trimmed.match(LIST_RE)![0].length;
      const itemText = trimmed.substring(bulletLen);
      const itemOffset = pos + indent + bulletLen;

      if (!currentList) currentList = [];
      currentList.push({ text: itemText, offset: itemOffset });
    } else {
      if (currentList) {
        blocks.push({ type: 'list', items: currentList });
        currentList = null;
      }
      if (trimmed.length > 0) {
        blocks.push({ type: 'paragraph', text: trimmed, offset: pos + indent });
      }
    }

    pos += line.length + 1; // +1 for the newline
  }

  if (currentList) {
    blocks.push({ type: 'list', items: currentList });
  }

  return blocks;
}

function QANode({ data }: QANodeProps) {
  const [promptText, setPromptText] = useState('');
  const [activeMarks, setActiveMarks] = useState<ActiveMark[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [recolorTarget, setRecolorTarget] = useState<string | null>(null);
  const [showNodeColor, setShowNodeColor] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [showOriginalPrompt, setShowOriginalPrompt] = useState(false);
  const [rootPromptText, setRootPromptText] = useState('');
  const responseRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const didSelectRef = useRef(false);

  const usedColorCount = new Set(data.persistedMarks.map((m) => m.color)).size;
  const defaultHex = getNextHex(usedColorCount);
  const activeHex = selectedHex ?? defaultHex;

  const nodeHex = data.branchColor || '#e5e7eb';

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    if (!responseRef.current?.contains(range.commonAncestorContainer)) return;

    const text = selection.toString().trim();
    if (!text || text.length < 2) return;

    const responseText = data.aiResponse;
    const startIndex = responseText.indexOf(text);
    if (startIndex === -1) return;

    const endIndex = startIndex + text.length;

    const alreadyActive = activeMarks.some((m) => m.startIndex === startIndex && m.endIndex === endIndex);
    const alreadyPersisted = data.persistedMarks.some((m) => m.startIndex === startIndex && m.endIndex === endIndex);
    if (!alreadyActive && !alreadyPersisted) {
      setActiveMarks((prev) => [
        ...prev,
        { id: `mark-${Date.now()}`, text, startIndex, endIndex },
      ]);
      setShowPrompt(true);
      setRecolorTarget(null);
      setShowNodeColor(false);
    }

    didSelectRef.current = true;
    selection.removeAllRanges();
  }, [data.aiResponse, data.persistedMarks, activeMarks]);

  const handleRemoveMark = useCallback((markId: string) => {
    setActiveMarks((prev) => {
      const next = prev.filter((m) => m.id !== markId);
      if (next.length === 0 && !promptText.trim()) setShowPrompt(false);
      return next;
    });
  }, [promptText]);

  const handleSubmit = useCallback(() => {
    const markedText = activeMarks.map((m) => m.text).join(', ');
    const prompt = promptText.trim()
      ? promptText
      : markedText
        ? `Explain: ${markedText}`
        : '';
    if (!prompt) return;

    const markPayloads = activeMarks.map((m) => ({
      text: m.text,
      startIndex: m.startIndex,
      endIndex: m.endIndex,
    }));

    data.onAsk(data.id, prompt, markPayloads, activeHex, markedText || undefined);
    setPromptText('');
    setActiveMarks([]);
    setShowPrompt(false);
    setSelectedHex(null);
  }, [data, promptText, activeMarks, activeHex]);

  const handleImagineSubmit = useCallback(() => {
    const markedText = activeMarks.map((m) => m.text).join(', ');
    const prompt = promptText.trim()
      ? promptText
      : markedText
        ? markedText
        : data.userPrompt;
    const context = data.aiResponse ? data.aiResponse.substring(0, 300) : '';

    data.onImagine(data.id, prompt, context);
    setPromptText('');
    setActiveMarks([]);
    setShowPrompt(false);
    setSelectedHex(null);
  }, [data, promptText, activeMarks]);

  const handleNoteSubmit = useCallback(() => {
    const markedText = activeMarks.map((m) => m.text).join(', ');
    const markPayloads = activeMarks.map((m) => ({
      text: m.text,
      startIndex: m.startIndex,
      endIndex: m.endIndex,
    }));

    data.onNote(data.id, markPayloads, activeHex, markedText || undefined);
    setPromptText('');
    setActiveMarks([]);
    setShowPrompt(false);
    setSelectedHex(null);
  }, [data, activeMarks, activeHex]);

  const handleStartEditTitle = useCallback(() => {
    setTitleDraft(data.title || data.userPrompt);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }, [data.title, data.userPrompt]);

  const handleSaveTitle = useCallback(() => {
    const trimmed = titleDraft.trim();
    if (trimmed) data.onUpdateTitle(data.id, trimmed);
    setEditingTitle(false);
  }, [data, titleDraft]);

  const handleRootPromptSubmit = useCallback(() => {
    const prompt = rootPromptText.trim();
    if (!prompt || !data.onSubmitRootPrompt) return;
    data.onSubmitRootPrompt(data.id, prompt);
    setRootPromptText('');
  }, [data, rootPromptText]);

  const handleOpenFreePrompt = useCallback(() => {
    setPromptText('');
    setShowPrompt(true);
    setRecolorTarget(null);
    setShowNodeColor(false);
  }, []);

  const handleClosePrompt = useCallback(() => {
    setShowPrompt(false);
    setActiveMarks([]);
    setPromptText('');
    setSelectedHex(null);
    setRecolorTarget(null);
  }, []);

  const handlePersistedMarkClick = useCallback((targetNodeId: string) => {
    setRecolorTarget((prev) => prev === targetNodeId ? null : targetNodeId);
    setShowPrompt(false);
    setShowNodeColor(false);
  }, []);

  const handleRecolor = useCallback((newHex: string) => {
    if (!recolorTarget) return;
    data.onRecolor(data.id, recolorTarget, newHex);
    setRecolorTarget(null);
  }, [data, recolorTarget]);

  const handleKeywordClick = useCallback((term: string, startIndex: number, endIndex: number, hex: string) => {
    if (didSelectRef.current) {
      didSelectRef.current = false;
      return;
    }
    const alreadyActive = activeMarks.some((m) => m.startIndex === startIndex && m.endIndex === endIndex);
    const alreadyPersisted = data.persistedMarks.some((m) => m.startIndex === startIndex && m.endIndex === endIndex);
    if (alreadyActive || alreadyPersisted) return;

    setSelectedHex(hex);
    setActiveMarks((prev) => [
      ...prev,
      { id: `mark-${Date.now()}`, text: term, startIndex, endIndex },
    ]);
    setShowPrompt(true);
    setRecolorTarget(null);
    setShowNodeColor(false);
  }, [activeMarks, data.persistedMarks]);

  // Parse response into prose/code segments
  type Segment = { type: 'prose'; text: string; offset: number } | { type: 'code'; lang: string; code: string; offset: number };
  const segments: Segment[] = [];
  if (data.aiResponse) {
    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
    let lastEnd = 0;
    let match;
    while ((match = codeBlockRegex.exec(data.aiResponse)) !== null) {
      if (match.index > lastEnd) {
        segments.push({ type: 'prose', text: data.aiResponse.substring(lastEnd, match.index), offset: lastEnd });
      }
      segments.push({ type: 'code', lang: match[1] || '', code: match[2].trim(), offset: match.index });
      lastEnd = match.index + match[0].length;
    }
    if (lastEnd < data.aiResponse.length) {
      segments.push({ type: 'prose', text: data.aiResponse.substring(lastEnd), offset: lastEnd });
    }
  }

  const isReady = !data.isLoading && !data.isExpanding && !!data.aiResponse;

  return (
    <div className="relative group" style={{ minWidth: 280, width: '100%', height: '100%' }}>
      <NodeResizer
        minWidth={280}
        minHeight={100}
        lineClassName="!border-transparent group-hover:!border-gray-300"
        handleClassName="!w-2.5 !h-2.5 !bg-gray-400 !border-white !border-2 !rounded-sm !opacity-0 group-hover:!opacity-100 transition-opacity"
      />
      <div
        className="rounded-xl shadow-lg border border-gray-200 overflow-hidden h-full flex flex-col"
        style={{ backgroundColor: tint(nodeHex, 0.07) }}
      >
        <Handle type="target" position={Position.Top} />

        {/* Header */}
        <div
          className="px-4 py-3 border-b flex items-start gap-2"
          style={{
            backgroundColor: tint(nodeHex, 0.15),
            borderColor: tint(nodeHex, 0.25),
            borderLeft: `4px solid ${nodeHex}`,
          }}
        >
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                onBlur={handleSaveTitle}
                className="w-full text-sm font-medium text-gray-900 bg-white/80 border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-gray-400 nodrag nopan"
              />
            ) : (
              <p
                className="text-sm font-medium text-gray-900 cursor-pointer hover:underline decoration-dotted underline-offset-2"
                onClick={handleStartEditTitle}
                title="Click to rename"
              >
                {data.title || data.userPrompt || 'Untitled'}
              </p>
            )}
            {data.branchedFromText && (
              <span className="text-xs text-gray-500 mt-0.5 inline-block">
                from &quot;{data.branchedFromText}&quot;
              </span>
            )}
            {showOriginalPrompt && data.userPrompt && (
              <p className="text-xs text-gray-500 mt-1 italic">
                Prompt: {data.userPrompt}
              </p>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
            {data.userPrompt && (
              <button
                onClick={() => setShowOriginalPrompt((v) => !v)}
                className={`p-1 transition-colors rounded ${showOriginalPrompt ? 'text-gray-700' : 'text-gray-400 hover:text-gray-700'}`}
                title={showOriginalPrompt ? 'Hide original prompt' : 'Show original prompt'}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showOriginalPrompt ? (
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            )}
            <button
              onClick={() => { setShowNodeColor((v) => !v); setRecolorTarget(null); setShowPrompt(false); }}
              className="w-4 h-4 rounded-full border-2 border-gray-300 hover:border-gray-500 transition-colors"
              style={{ backgroundColor: nodeHex }}
              title="Change node color"
            />
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="p-1 text-gray-400 hover:text-gray-700 transition-colors rounded"
              title={collapsed ? 'Expand node' : 'Collapse node'}
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={() => data.onDelete(data.id)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
              title="Remove node"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Node color picker */}
        {showNodeColor && (
          <div className="px-4 py-2 border-b flex items-center gap-2 nodrag nopan"
               style={{ backgroundColor: tint(nodeHex, 0.1), borderColor: tint(nodeHex, 0.2) }}>
            <span className="text-xs text-gray-500">Node color:</span>
            <ColorPicker value={nodeHex} onChange={(hex) => data.onNodeRecolor(data.id, hex)} />
            <button onClick={() => setShowNodeColor(false)} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">✕</button>
          </div>
        )}

        {collapsed && (data.aiResponse || data.isAwaitingPrompt) && !data.hasFailed && (
          <div className="px-4 py-2" style={{ backgroundColor: tint(nodeHex, 0.04) }}>
            <p className="text-xs text-gray-500 truncate">
              {data.aiResponse ? data.aiResponse.replace(/```[\s\S]*?```/g, '').trim().substring(0, 100) : 'Awaiting prompt...'}
            </p>
          </div>
        )}

        {!collapsed && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Initial prompt input for blank nodes */}
            {data.isAwaitingPrompt && !data.isLoading && (
              <div className="px-4 py-6 flex flex-col items-center gap-3 nodrag nopan">
                <p className="text-sm text-gray-500">What would you like to explore?</p>
                <div className="flex gap-2 w-full">
                  <input
                    type="text"
                    value={rootPromptText}
                    onChange={(e) => setRootPromptText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRootPromptSubmit();
                      if (e.key === 'Escape') data.onDelete(data.id);
                    }}
                    placeholder="Ask anything..."
                    className="flex-1 min-w-0 text-sm px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700 placeholder:text-gray-400"
                    autoFocus
                  />
                  <button
                    onClick={handleRootPromptSubmit}
                    disabled={!rootPromptText.trim()}
                    className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors"
                  >
                    Go
                  </button>
                </div>
              </div>
            )}

            {/* Response body */}
            {(data.isLoading || data.isExpanding) ? (
              <div className="px-4 py-6 flex items-center gap-2 text-gray-400">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                {data.isExpanding && <span className="text-xs ml-2">Expanding...</span>}
              </div>
            ) : data.aiResponse ? (
              <>
                <div className="px-4 py-3 nodrag nopan cursor-text flex-1 min-h-0 overflow-auto" ref={responseRef} onMouseUp={handleMouseUp}>
                  <div className="text-sm text-gray-700 leading-relaxed select-text space-y-2">
                    {segments.map((seg) => {
                      if (seg.type === 'code') {
                        return (
                          <pre
                            key={`code-${seg.offset}`}
                            className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre"
                          >
                            {seg.lang && (
                              <span className="text-gray-500 text-[10px] block mb-1">{seg.lang}</span>
                            )}
                            <code>{seg.code}</code>
                          </pre>
                        );
                      }

                      const segKeywords = data.keywords
                        .filter((kw) => kw.startIndex >= seg.offset && kw.endIndex <= seg.offset + seg.text.length)
                        .map((kw) => ({ ...kw, startIndex: kw.startIndex - seg.offset, endIndex: kw.endIndex - seg.offset }));
                      const segPersisted = data.persistedMarks
                        .filter((m) => m.startIndex >= seg.offset && m.endIndex <= seg.offset + seg.text.length)
                        .map((m) => ({ ...m, startIndex: m.startIndex - seg.offset, endIndex: m.endIndex - seg.offset }));
                      const segActive = activeMarks
                        .filter((m) => m.startIndex >= seg.offset && m.endIndex <= seg.offset + seg.text.length)
                        .map((m) => ({ ...m, startIndex: m.startIndex - seg.offset, endIndex: m.endIndex - seg.offset }));

                      const segText = seg.text;
                      const renderSpansForRange = (rangeOffset: number, rangeLen: number, keyPrefix: string) => {
                        const spans = buildSpans(
                          rangeLen,
                          segKeywords.filter((kw) => kw.startIndex < rangeOffset + rangeLen && kw.endIndex > rangeOffset)
                            .map((kw) => ({ ...kw, startIndex: Math.max(0, kw.startIndex - rangeOffset), endIndex: Math.min(rangeLen, kw.endIndex - rangeOffset) })),
                          segPersisted.filter((m) => m.startIndex < rangeOffset + rangeLen && m.endIndex > rangeOffset)
                            .map((m) => ({ ...m, startIndex: Math.max(0, m.startIndex - rangeOffset), endIndex: Math.min(rangeLen, m.endIndex - rangeOffset) })),
                          segActive.filter((m) => m.startIndex < rangeOffset + rangeLen && m.endIndex > rangeOffset)
                            .map((m) => ({ ...m, startIndex: Math.max(0, m.startIndex - rangeOffset), endIndex: Math.min(rangeLen, m.endIndex - rangeOffset) })),
                          activeHex
                        );
                        return spans.map((span) => {
                          const localText = segText.substring(rangeOffset + span.start, rangeOffset + span.end);
                          if (span.type === 'persisted' && span.hex) {
                            const isRecoloring = recolorTarget === span.targetNodeId;
                            return (
                              <span
                                key={`${keyPrefix}-p-${span.start}`}
                                onClick={() => span.targetNodeId && handlePersistedMarkClick(span.targetNodeId)}
                                className={`rounded-sm font-medium cursor-pointer ${isRecoloring ? 'ring-2 ring-gray-800 ring-offset-1' : ''}`}
                                style={{ backgroundColor: tint(span.hex, 0.3), color: darken(span.hex, 0.3) }}
                              >{localText}</span>
                            );
                          }
                          if (span.type === 'active' && span.hex) {
                            return (
                              <span key={`${keyPrefix}-a-${span.start}`} className="rounded-sm font-medium"
                                style={{ backgroundColor: tint(span.hex, 0.3), color: darken(span.hex, 0.3) }}
                              >{localText}</span>
                            );
                          }
                          if (span.type === 'keyword') {
                            const kwHex = span.hex || '#f59e0b';
                            const absStart = seg.offset + rangeOffset + span.start;
                            const absEnd = seg.offset + rangeOffset + span.end;
                            return (
                              <span key={`${keyPrefix}-kw-${span.start}`}
                                className="rounded-sm border-b-2 border-dashed cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: `${kwHex}18`, color: kwHex, borderColor: `${kwHex}80` }}
                                onClick={() => handleKeywordClick(localText, absStart, absEnd, kwHex)}
                                title={`Click to explore "${localText}"`}
                              >{localText}</span>
                            );
                          }
                          return <span key={`${keyPrefix}-${span.start}`}>{localText}</span>;
                        });
                      };

                      const blocks = splitProseBlocks(segText);

                      return (
                        <div key={`prose-${seg.offset}`}>
                          {blocks.map((block, bi) => {
                            if (block.type === 'list') {
                              return (
                                <ul key={`list-${seg.offset}-${bi}`} className="list-disc pl-5 space-y-0.5">
                                  {block.items.map((item, ii) => (
                                    <li key={`li-${seg.offset}-${bi}-${ii}`}>
                                      {renderSpansForRange(item.offset - seg.offset, item.text.length, `li-${bi}-${ii}`)}
                                    </li>
                                  ))}
                                </ul>
                              );
                            }
                            return (
                              <p key={`p-${seg.offset}-${bi}`}>
                                {renderSpansForRange(block.offset - seg.offset, block.text.length, `p-${bi}`)}
                              </p>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="px-4 py-1.5 border-t flex justify-end gap-3"
                     style={{ borderColor: tint(nodeHex, 0.15) }}>
                  {data.hasFailed ? (
                    <button
                      onClick={() => data.onRetry(data.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors flex items-center gap-1 font-medium"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Retry
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleOpenFreePrompt}
                        className="text-xs text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
                        title="Generate an illustration for this concept"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Imagine
                      </button>
                      <button
                        onClick={() => data.onExpand(data.id)}
                        className="text-xs text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M7 17L17 7M17 7H7M17 7v10" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Expand
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : null}

            {/* Recolor picker for persisted marks */}
            {recolorTarget && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2 nodrag nopan">
                <span className="text-xs text-gray-500">Mark color:</span>
                <ColorPicker
                  value={data.persistedMarks.find((m) => m.targetNodeId === recolorTarget)?.color ?? '#8b5cf6'}
                  onChange={handleRecolor}
                />
                <button onClick={() => setRecolorTarget(null)} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">✕</button>
              </div>
            )}

            {/* Active marks + prompt */}
            {showPrompt && (
              <div className="px-4 py-3 border-t"
                   style={{ backgroundColor: tint(nodeHex, 0.1), borderColor: tint(nodeHex, 0.15) }}>
                {activeMarks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {activeMarks.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: tint(activeHex, 0.2),
                          color: darken(activeHex, 0.2),
                        }}
                      >
                        {m.text}
                        <button
                          onClick={() => handleRemoveMark(m.id)}
                          className="opacity-50 hover:opacity-100 transition-opacity leading-none"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2 nodrag nopan">
                  <span className="text-xs text-gray-500">Color:</span>
                  <ColorPicker value={activeHex} onChange={(hex) => setSelectedHex(hex)} />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmit();
                      if (e.key === 'Escape') handleClosePrompt();
                    }}
                    placeholder={activeMarks.length ? 'Add a question (optional)' : 'Ask something...'}
                    className="flex-1 min-w-0 text-sm px-2 py-1.5 rounded border border-gray-200 bg-white
                               focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700
                               placeholder:text-gray-400 nodrag nopan"
                    autoFocus
                  />
                  <button
                    onClick={handleClosePrompt}
                    className="shrink-0 px-2 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    onClick={handleSubmit}
                    disabled={activeMarks.length === 0 && !promptText.trim()}
                    className="px-3 py-1 text-xs rounded hover:opacity-90 disabled:opacity-40 transition-all font-medium"
                    style={{ backgroundColor: activeHex, color: contrastText(activeHex) }}
                  >
                    Ask
                  </button>
                  <button
                    onClick={handleNoteSubmit}
                    className="px-3 py-1 text-xs rounded hover:opacity-90 transition-all font-medium
                               bg-amber-500 text-white"
                    title="Add a personal note"
                  >
                    Note
                  </button>
                  <button
                    onClick={handleImagineSubmit}
                    className="px-3 py-1 text-xs rounded hover:opacity-90 transition-all font-medium
                               bg-indigo-500 text-white"
                    title="Generate an image from this prompt"
                  >
                    Imagine
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <Handle type="source" position={Position.Bottom} />
      </div>

      {/* Floating ask button */}
      {isReady && !collapsed && !showPrompt && !recolorTarget && !showNodeColor && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
          <button
            onClick={handleOpenFreePrompt}
            className="opacity-0 group-hover:opacity-100
                       bg-gray-800 text-white rounded-full w-7 h-7
                       flex items-center justify-center shadow-md
                       hover:bg-gray-900 hover:scale-110 transition-all duration-200
                       text-lg leading-none"
            title="Ask from here"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(QANode);
