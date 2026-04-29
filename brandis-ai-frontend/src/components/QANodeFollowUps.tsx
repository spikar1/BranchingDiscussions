import { tint } from '@/lib/colors';

type QANodeFollowUpsProps = {
  nodeId: string;
  nodeHex: string;
  questions: string[];
  collapsed: boolean;
  isRefreshing: boolean;
  onToggleCollapsed: () => void;
  onRefresh: () => void;
  onAskFollowUp: (question: string) => void;
};

export default function QANodeFollowUps({
  nodeId,
  nodeHex,
  questions,
  collapsed,
  isRefreshing,
  onToggleCollapsed,
  onRefresh,
  onAskFollowUp,
}: QANodeFollowUpsProps) {
  if (!Array.isArray(questions) || questions.length === 0) return null;

  return (
    <div
      className="px-4 py-2 border-t space-y-2"
      style={{ borderColor: tint(nodeHex, 0.15) }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">Next useful questions</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapsed}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            title={collapsed ? 'Expand questions' : 'Collapse questions'}
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
            title="Give new questions"
          >
            {isRefreshing ? 'Refreshing...' : 'Give new questions'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="flex flex-wrap gap-1.5">
          {questions.map((question, index) => (
            <button
              key={`${nodeId}-followup-${index}`}
              onClick={() => onAskFollowUp(question)}
              className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors"
              title="Ask this follow-up"
            >
              {question}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
