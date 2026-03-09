'use client';

import { memo, useCallback, useState, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { QANodeData, SuggestedKeyword, PersistedMark } from '@/types/canvas';
import { getColor, getColorById, getClosestPaletteColor } from '@/lib/colors';
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
    colorId: string,
    fromText?: string
  ) => void;
  onRecolor: (nodeId: string, targetNodeId: string, newColorId: string) => void;
  onDelete: (nodeId: string) => void;
  onExpand: (nodeId: string) => void;
  onImagine: (nodeId: string) => void;
};

type QANodeProps = NodeProps & {
  data: QANodeData & QANodeCallbacks & { isLoading?: boolean; isExpanding?: boolean };
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
  colorId?: string;
  targetNodeId?: string;
  hex?: string;
};

function buildSpans(
  textLength: number,
  keywords: SuggestedKeyword[],
  persistedMarks: PersistedMark[],
  activeMarks: ActiveMark[],
  activeColorId: string
): Span[] {
  const points = new Set<number>();
  points.add(0);
  points.add(textLength);

  type Region = {
    start: number; end: number;
    type: 'keyword' | 'persisted' | 'active';
    colorId?: string; targetNodeId?: string; hex?: string; priority: number;
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
      colorId: m.color, targetNodeId: m.targetNodeId, priority: 2,
    });
  }
  for (const m of activeMarks) {
    points.add(m.startIndex);
    points.add(m.endIndex);
    regions.push({ start: m.startIndex, end: m.endIndex, type: 'active', colorId: activeColorId, priority: 1 });
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
      spans.push({ start, end, type: top.type, colorId: top.colorId, targetNodeId: top.targetNodeId, hex: top.hex });
    } else {
      spans.push({ start, end, type: 'plain' });
    }
  }

  return spans;
}

function QANode({ data }: QANodeProps) {
  const [promptText, setPromptText] = useState('');
  const [activeMarks, setActiveMarks] = useState<ActiveMark[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [recolorTarget, setRecolorTarget] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const responseRef = useRef<HTMLDivElement>(null);
  const didSelectRef = useRef(false);

  const usedColorCount = new Set(data.persistedMarks.map((m) => m.color)).size;
  const defaultColor = getColor(usedColorCount);
  const activeColor = selectedColorId ? getColorById(selectedColorId) : defaultColor;

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

    data.onAsk(data.id, prompt, markPayloads, activeColor.id, markedText || undefined);
    setPromptText('');
    setActiveMarks([]);
    setShowPrompt(false);
    setSelectedColorId(null);
  }, [data, promptText, activeMarks, activeColor]);

  const handleOpenFreePrompt = useCallback(() => {
    setPromptText('');
    setShowPrompt(true);
    setRecolorTarget(null);
  }, []);

  const handleClosePrompt = useCallback(() => {
    setShowPrompt(false);
    setActiveMarks([]);
    setPromptText('');
    setSelectedColorId(null);
    setRecolorTarget(null);
  }, []);

  const handlePersistedMarkClick = useCallback((targetNodeId: string) => {
    setRecolorTarget((prev) => prev === targetNodeId ? null : targetNodeId);
    setShowPrompt(false);
  }, []);

  const handleKeywordClick = useCallback((term: string, startIndex: number, endIndex: number, hex: string) => {
    if (didSelectRef.current) {
      didSelectRef.current = false;
      return;
    }
    const alreadyActive = activeMarks.some((m) => m.startIndex === startIndex && m.endIndex === endIndex);
    const alreadyPersisted = data.persistedMarks.some((m) => m.startIndex === startIndex && m.endIndex === endIndex);
    if (alreadyActive || alreadyPersisted) return;

    const closest = getClosestPaletteColor(hex);
    setSelectedColorId(closest.id);
    setActiveMarks((prev) => [
      ...prev,
      { id: `mark-${Date.now()}`, text: term, startIndex, endIndex },
    ]);
    setShowPrompt(true);
    setRecolorTarget(null);
  }, [activeMarks, data.persistedMarks]);

  const handleRecolor = useCallback((newColorId: string) => {
    if (!recolorTarget) return;
    data.onRecolor(data.id, recolorTarget, newColorId);
    setRecolorTarget(null);
  }, [data, recolorTarget]);

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

  const headerBorderColor = data.branchColor
    ? { borderLeft: `4px solid ${getColorById(data.branchColor).edge}` }
    : {};

  const isReady = !data.isLoading && !data.isExpanding && !!data.aiResponse;

  return (
    <div className="relative group">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 w-[380px] overflow-hidden">
        <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0 !min-w-0 !min-h-0" />

        {/* Header with controls */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-start gap-2" style={headerBorderColor}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{data.userPrompt}</p>
            {data.branchedFromText && (
              <span className="text-xs text-gray-500 mt-0.5 inline-block">
                from &quot;{data.branchedFromText}&quot;
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
            {/* Collapse toggle */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="p-1 text-gray-400 hover:text-gray-700 transition-colors rounded"
              title={collapsed ? 'Expand node' : 'Collapse node'}
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {/* Delete node */}
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

        {/* Collapsed state — just the header */}
        {!collapsed && (
          <>
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
                <div className="px-4 py-3 nodrag nopan cursor-text" ref={responseRef} onMouseUp={handleMouseUp}>
                  <div className="text-sm text-gray-700 leading-relaxed select-text space-y-2">
                    {segments.map((seg) => {
                      if (seg.type === 'code') {
                        return (
                          <pre
                            key={`code-${seg.offset}`}
                            className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono
                                       overflow-x-auto whitespace-pre"
                          >
                            {seg.lang && (
                              <span className="text-gray-500 text-[10px] block mb-1">{seg.lang}</span>
                            )}
                            <code>{seg.code}</code>
                          </pre>
                        );
                      }

                      const proseSpans = buildSpans(
                        seg.text.length,
                        data.keywords
                          .filter((kw) => kw.startIndex >= seg.offset && kw.endIndex <= seg.offset + seg.text.length)
                          .map((kw) => ({ ...kw, startIndex: kw.startIndex - seg.offset, endIndex: kw.endIndex - seg.offset })),
                        data.persistedMarks
                          .filter((m) => m.startIndex >= seg.offset && m.endIndex <= seg.offset + seg.text.length)
                          .map((m) => ({ ...m, startIndex: m.startIndex - seg.offset, endIndex: m.endIndex - seg.offset })),
                        activeMarks
                          .filter((m) => m.startIndex >= seg.offset && m.endIndex <= seg.offset + seg.text.length)
                          .map((m) => ({ ...m, startIndex: m.startIndex - seg.offset, endIndex: m.endIndex - seg.offset })),
                        activeColor.id
                      );

                      return (
                        <p key={`prose-${seg.offset}`}>
                          {proseSpans.map((span) => {
                            const text = seg.text.substring(span.start, span.end);

                            if (span.type === 'persisted' && span.colorId) {
                              const c = getColorById(span.colorId);
                              const isRecoloring = recolorTarget === span.targetNodeId;
                              return (
                                <span
                                  key={`p-${seg.offset}-${span.start}`}
                                  onClick={() => span.targetNodeId && handlePersistedMarkClick(span.targetNodeId)}
                                  className={`${c.bg} ${c.text} rounded-sm font-medium cursor-pointer
                                              ${isRecoloring ? 'ring-2 ring-gray-800 ring-offset-1' : ''}`}
                                >
                                  {text}
                                </span>
                              );
                            }

                            if (span.type === 'active' && span.colorId) {
                              const c = getColorById(span.colorId);
                              return (
                                <span key={`a-${seg.offset}-${span.start}`} className={`${c.bg} ${c.text} rounded-sm font-medium`}>
                                  {text}
                                </span>
                              );
                            }

                            if (span.type === 'keyword') {
                              const kwHex = span.hex || '#f59e0b';
                              const absStart = seg.offset + span.start;
                              const absEnd = seg.offset + span.end;
                              return (
                                <span
                                  key={`kw-${seg.offset}-${span.start}`}
                                  className="rounded-sm border-b-2 border-dashed cursor-pointer hover:opacity-80 transition-opacity"
                                  style={{
                                    backgroundColor: `${kwHex}18`,
                                    color: kwHex,
                                    borderColor: `${kwHex}80`,
                                  }}
                                  onClick={() => handleKeywordClick(text, absStart, absEnd, kwHex)}
                                >
                                  {text}
                                </span>
                              );
                            }

                            return <span key={`plain-${seg.offset}-${span.start}`}>{text}</span>;
                          })}
                        </p>
                      );
                    })}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="px-4 py-1.5 border-t border-gray-100 flex justify-end gap-3">
                  <button
                    onClick={() => data.onImagine(data.id)}
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
                </div>
              </>
            ) : null}

            {/* Recolor picker */}
            {recolorTarget && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2 nodrag nopan">
                <span className="text-xs text-gray-500">Change color:</span>
                <ColorPicker
                  selectedId={data.persistedMarks.find((m) => m.targetNodeId === recolorTarget)?.color ?? 'violet'}
                  onChange={handleRecolor}
                />
                <button
                  onClick={() => setRecolorTarget(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Active marks + prompt */}
            {showPrompt && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                {activeMarks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {activeMarks.map((m) => (
                      <span
                        key={m.id}
                        className={`inline-flex items-center gap-1 ${activeColor.tag} ${activeColor.tagText} text-xs
                                   px-2 py-0.5 rounded-full font-medium`}
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
                  <ColorPicker
                    selectedId={activeColor.id}
                    onChange={(id) => setSelectedColorId(id)}
                  />
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
                    className="flex-1 text-sm px-2 py-1.5 rounded border border-gray-200 bg-white
                               focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700
                               placeholder:text-gray-400 nodrag nopan"
                    autoFocus
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={activeMarks.length === 0 && !promptText.trim()}
                    className="px-3 py-1.5 text-sm text-white rounded
                               hover:opacity-90 disabled:opacity-40 transition-all font-medium"
                    style={{ backgroundColor: activeColor.edge }}
                  >
                    Ask
                  </button>
                  <button
                    onClick={handleClosePrompt}
                    className="px-2 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0 !min-w-0 !min-h-0" />
      </div>

      {/* Floating ask button */}
      {isReady && !collapsed && !showPrompt && !recolorTarget && (
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
