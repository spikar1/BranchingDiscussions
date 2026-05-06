import { contrastText, darken, tint } from '@/lib/colors';
import ColorPicker from './ColorPicker';
import { type ActiveMark } from './qaNodeText';

type QANodePromptComposerProps = {
  nodeHex: string;
  activeMarks: ActiveMark[];
  activeHex: string;
  promptText: string;
  onPromptTextChange: (value: string) => void;
  onSetHex: (hex: string) => void;
  onRemoveMark: (markId: string) => void;
  onClose: () => void;
  onAsk: () => void;
  onNote: () => void;
  onImagine: () => void;
};

export default function QANodePromptComposer({
  nodeHex,
  activeMarks,
  activeHex,
  promptText,
  onPromptTextChange,
  onSetHex,
  onRemoveMark,
  onClose,
  onAsk,
  onNote,
  onImagine,
}: QANodePromptComposerProps) {
  return (
    <div
      className="px-4 py-3 border-t"
      style={{ backgroundColor: tint(nodeHex, 0.1), borderColor: tint(nodeHex, 0.15) }}
    >
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
                onClick={() => onRemoveMark(m.id)}
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
        <ColorPicker value={activeHex} onChange={onSetHex} />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={promptText}
          onChange={(e) => onPromptTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAsk();
            if (e.key === 'Escape') onClose();
          }}
          placeholder={activeMarks.length ? 'Add a question (optional)' : 'Ask something...'}
          className="flex-1 min-w-0 text-sm px-2 py-1.5 rounded border border-gray-200 bg-white
                     focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700
                     placeholder:text-gray-400 nodrag nopan"
          autoFocus
        />
        <button
          onClick={onClose}
          className="shrink-0 px-2 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <button
          onClick={onAsk}
          disabled={activeMarks.length === 0 && !promptText.trim()}
          className="px-3 py-1 text-xs rounded hover:opacity-90 disabled:opacity-40 transition-all font-medium"
          style={{ backgroundColor: activeHex, color: contrastText(activeHex) }}
        >
          Ask
        </button>
        <button
          onClick={onNote}
          className="px-3 py-1 text-xs rounded hover:opacity-90 transition-all font-medium bg-amber-500 text-white"
          title="Add a personal note"
        >
          Note
        </button>
        <button
          onClick={onImagine}
          className="px-3 py-1 text-xs rounded hover:opacity-90 transition-all font-medium bg-indigo-500 text-white"
          title="Generate an image from this prompt"
        >
          Imagine
        </button>
      </div>
    </div>
  );
}
