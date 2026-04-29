import { RefObject } from 'react';
import { tint } from '@/lib/colors';

type QANodeHeaderProps = {
  nodeHex: string;
  title: string;
  userPrompt: string;
  branchedFromText: string | null;
  editingTitle: boolean;
  titleDraft: string;
  setTitleDraft: (value: string) => void;
  setEditingTitle: (value: boolean) => void;
  showOriginalPrompt: boolean;
  setShowOriginalPrompt: (value: boolean | ((prev: boolean) => boolean)) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onToggleNodeColor: () => void;
  onDelete: () => void;
  onStartEditTitle: () => void;
  onSaveTitle: () => void;
  titleInputRef: RefObject<HTMLInputElement>;
};

export default function QANodeHeader({
  nodeHex,
  title,
  userPrompt,
  branchedFromText,
  editingTitle,
  titleDraft,
  setTitleDraft,
  setEditingTitle,
  showOriginalPrompt,
  setShowOriginalPrompt,
  collapsed,
  onToggleCollapsed,
  onToggleNodeColor,
  onDelete,
  onStartEditTitle,
  onSaveTitle,
  titleInputRef,
}: QANodeHeaderProps) {
  return (
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
              if (e.key === 'Enter') onSaveTitle();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            onBlur={onSaveTitle}
            className="w-full text-sm font-medium text-gray-900 bg-white/80 border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-gray-400 nodrag nopan"
          />
        ) : (
          <p
            className="text-sm font-medium text-gray-900 cursor-pointer hover:underline decoration-dotted underline-offset-2"
            onClick={onStartEditTitle}
            title="Click to rename"
          >
            {title || userPrompt || 'Untitled'}
          </p>
        )}
        {branchedFromText && (
          <span className="text-xs text-gray-500 mt-0.5 inline-block">
            from &quot;{branchedFromText}&quot;
          </span>
        )}
        {showOriginalPrompt && userPrompt && (
          <p className="text-xs text-gray-500 mt-1 italic">
            Prompt: {userPrompt}
          </p>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
        {userPrompt && (
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
          onClick={onToggleNodeColor}
          className="w-4 h-4 rounded-full border-2 border-gray-300 hover:border-gray-500 transition-colors"
          style={{ backgroundColor: nodeHex }}
          title="Change node color"
        />
        <button
          onClick={onToggleCollapsed}
          className="p-1 text-gray-400 hover:text-gray-700 transition-colors rounded"
          title={collapsed ? 'Expand node' : 'Collapse node'}
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
          title="Remove node"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
