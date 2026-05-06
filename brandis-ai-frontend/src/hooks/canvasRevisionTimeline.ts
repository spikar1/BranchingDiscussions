/**
 * Task D (prd-task-graph): immutable revision entries with stable ids and parent pointers.
 * Graph state is reproducible by replaying `entries[0..headIndex]` from an empty graph.
 */

import type { CanvasGraphCommand, CanvasGraphState } from './canvasGraphCommands';
import { applyCanvasGraphCommand } from './canvasGraphCommands';

export type CanvasRevisionEntry = {
  id: string;
  parentRevisionId: string | null;
  createdAt: string;
  command: CanvasGraphCommand;
};

export type CanvasRevisionTimeline = {
  entries: CanvasRevisionEntry[];
  /** Index of the current tip; -1 when no commits yet. */
  headIndex: number;
};

export function emptyTimeline(): CanvasRevisionTimeline {
  return { entries: [], headIndex: -1 };
}

function newRevisionId(): string {
  return crypto.randomUUID();
}

/** Append a revision after the current head; drops any alternate future branch (redo stack). */
export function appendRevision(
  timeline: CanvasRevisionTimeline,
  command: CanvasGraphCommand
): CanvasRevisionTimeline {
  const parentRevisionId =
    timeline.headIndex >= 0 ? timeline.entries[timeline.headIndex].id : null;
  const entry: CanvasRevisionEntry = {
    id: newRevisionId(),
    parentRevisionId,
    createdAt: new Date().toISOString(),
    command,
  };
  const entries = timeline.entries.slice(0, timeline.headIndex + 1);
  entries.push(entry);
  return { entries, headIndex: entries.length - 1 };
}

/** Recompute graph at `timeline.headIndex` (for assertions, future undo/redo). */
export function replayTimeline(timeline: CanvasRevisionTimeline): CanvasGraphState {
  let state: CanvasGraphState = { nodes: [], edges: [] };
  if (timeline.headIndex < 0) return state;
  for (let i = 0; i <= timeline.headIndex; i++) {
    state = applyCanvasGraphCommand(state, timeline.entries[i].command);
  }
  return state;
}
