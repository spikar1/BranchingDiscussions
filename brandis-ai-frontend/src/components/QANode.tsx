'use client';

/**
 * Implements the main Q&A node UI, including response rendering, branching actions, and highlight interactions.
 * Read `handleSubmit`, `handleKeywordClick`, `handleMouseUp`, and `handleRefreshFollowUps` for core behavior.
 */
import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import {
  type QAModelOutputRevision,
  QANodeRuntimeFlags,
  QAProductPayload,
} from '@/types/canvas';
import { getNextHex, tint, darken } from '@/lib/colors';
import ColorPicker from './ColorPicker';
import QANodeHeader from './QANodeHeader';
import QANodeFollowUps from './QANodeFollowUps';
import QANodePromptComposer from './QANodePromptComposer';
import {
  buildSpans,
  splitProseBlocks,
  getHighlightTextShadow,
  parseResponseSegments,
  type ActiveMark,
} from './qaNodeText';

function formatSupersededAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function revisionSourceLabel(source: QAModelOutputRevision['source']): string {
  return source === 'expand' ? 'Before expand' : 'Regenerated';
}

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
  onRefreshFollowUps?: (nodeId: string) => Promise<void>;
  onCreateDraftFollowUp?: (sourceNodeId: string, prompt: string, hex: string) => void;
};

type QANodeProps = NodeProps & {
  /** Product payload + runtime flags merged on `data`; callbacks injected by canvas hook. */
  data: QAProductPayload & QANodeCallbacks & QANodeRuntimeFlags;
};

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
  const [isRefreshingFollowUps, setIsRefreshingFollowUps] = useState(false);
  const [followUpsCollapsed, setFollowUpsCollapsed] = useState(false);
  const [priorAnswersOpen, setPriorAnswersOpen] = useState(false);
  const responseRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const rootPromptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const didSelectRef = useRef(false);

  const usedColorCount = new Set(data.persistedMarks.map((m) => m.color)).size;
  const defaultHex = getNextHex(usedColorCount);
  const activeHex = selectedHex ?? defaultHex;

  const nodeHex = data.branchColor || '#e5e7eb';

  useEffect(() => {
    if (data.isAwaitingPrompt) {
      setRootPromptText(data.userPrompt ?? '');
    }
  }, [data.isAwaitingPrompt, data.userPrompt]);

  useEffect(() => {
    const el = rootPromptTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [rootPromptText, data.isAwaitingPrompt]);

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
    setFollowUpsCollapsed(true);
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

  const handleAskFollowUp = useCallback((question: string) => {
    if (data.onCreateDraftFollowUp) {
      data.onCreateDraftFollowUp(data.id, question, defaultHex);
    } else {
      data.onAsk(data.id, question, [], defaultHex);
    }
    setFollowUpsCollapsed(true);
  }, [data, defaultHex]);

  const handleRefreshFollowUps = useCallback(async () => {
    if (!data.onRefreshFollowUps || isRefreshingFollowUps) return;
    setIsRefreshingFollowUps(true);
    try {
      await data.onRefreshFollowUps(data.id);
    } finally {
      setIsRefreshingFollowUps(false);
    }
  }, [data, isRefreshingFollowUps]);

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

  const segments = parseResponseSegments(data.aiResponse);

  const isReady = !data.isLoading && !data.isExpanding && !!data.aiResponse;

  const priorAnswers = data.answerRevisions ?? [];

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

        <QANodeHeader
          nodeHex={nodeHex}
          title={data.title}
          userPrompt={data.userPrompt}
          branchedFromText={data.branchedFromText}
          editingTitle={editingTitle}
          titleDraft={titleDraft}
          setTitleDraft={setTitleDraft}
          setEditingTitle={setEditingTitle}
          showOriginalPrompt={showOriginalPrompt}
          setShowOriginalPrompt={setShowOriginalPrompt}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          onToggleNodeColor={() => {
            setShowNodeColor((v) => !v);
            setRecolorTarget(null);
            setShowPrompt(false);
          }}
          onDelete={() => data.onDelete(data.id)}
          onStartEditTitle={handleStartEditTitle}
          onSaveTitle={handleSaveTitle}
          titleInputRef={titleInputRef}
        />

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
                  <textarea
                    ref={rootPromptTextareaRef}
                    value={rootPromptText}
                    onChange={(e) => setRootPromptText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleRootPromptSubmit();
                      }
                      if (e.key === 'Escape') data.onDelete(data.id);
                    }}
                    placeholder="Ask anything..."
                    rows={1}
                    className="flex-1 min-w-0 text-sm px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700 placeholder:text-gray-400 resize-none overflow-hidden"
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
                                style={{
                                  backgroundColor: tint(span.hex, 0.3),
                                  color: darken(span.hex, 0.42),
                                  textShadow: getHighlightTextShadow(span.hex),
                                }}
                              >{localText}</span>
                            );
                          }
                          if (span.type === 'active' && span.hex) {
                            return (
                              <span key={`${keyPrefix}-a-${span.start}`} className="rounded-sm font-medium"
                                style={{
                                  backgroundColor: tint(span.hex, 0.3),
                                  color: darken(span.hex, 0.42),
                                  textShadow: getHighlightTextShadow(span.hex),
                                }}
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
                                style={{
                                  backgroundColor: `${kwHex}18`,
                                  color: darken(kwHex, 0.38),
                                  borderColor: `${kwHex}80`,
                                  textShadow: getHighlightTextShadow(kwHex),
                                }}
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

                {priorAnswers.length > 0 && (
                  <div
                    className="border-t nodrag nopan"
                    style={{
                      borderColor: tint(nodeHex, 0.12),
                      backgroundColor: tint(nodeHex, 0.04),
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPriorAnswersOpen((o) => !o)}
                      aria-expanded={priorAnswersOpen}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-black/[0.03] transition-colors flex items-center gap-2"
                    >
                      <svg
                        className={`w-3 h-3 shrink-0 transition-transform ${priorAnswersOpen ? 'rotate-90' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                      >
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Prior answers ({priorAnswers.length})
                    </button>
                    {priorAnswersOpen && (
                      <div className="px-4 pb-3 space-y-2 max-h-56 overflow-y-auto border-t border-gray-200/60">
                        {[...priorAnswers].reverse().map((rev) => (
                          <details
                            key={rev.id}
                            className="rounded-lg border border-gray-200/90 bg-white/70 overflow-hidden"
                          >
                            <summary className="px-3 py-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden flex flex-wrap gap-x-2 gap-y-1 items-baseline justify-between">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                {revisionSourceLabel(rev.source)}
                              </span>
                              <time className="text-[10px] text-gray-400 shrink-0" dateTime={rev.supersededAt}>
                                {formatSupersededAt(rev.supersededAt)}
                              </time>
                            </summary>
                            <div className="px-3 pb-2 pt-0 text-xs text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto border-t border-gray-100 bg-white/60">
                              {rev.aiResponse}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <QANodeFollowUps
                  nodeId={data.id}
                  nodeHex={nodeHex}
                  questions={data.followUpQuestions}
                  collapsed={followUpsCollapsed}
                  isRefreshing={isRefreshingFollowUps}
                  onToggleCollapsed={() => setFollowUpsCollapsed((v) => !v)}
                  onRefresh={handleRefreshFollowUps}
                  onAskFollowUp={handleAskFollowUp}
                />

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
              <QANodePromptComposer
                nodeHex={nodeHex}
                activeMarks={activeMarks}
                activeHex={activeHex}
                promptText={promptText}
                onPromptTextChange={setPromptText}
                onSetHex={setSelectedHex}
                onRemoveMark={handleRemoveMark}
                onClose={handleClosePrompt}
                onAsk={handleSubmit}
                onNote={handleNoteSubmit}
                onImagine={handleImagineSubmit}
              />
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
