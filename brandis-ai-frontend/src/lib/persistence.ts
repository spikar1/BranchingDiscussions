import { type Node, type Edge } from '@xyflow/react';

const STORAGE_KEY = 'brandis-canvas-state';
const DEBOUNCE_MS = 1000;

type PersistedState = {
  nodes: Node[];
  edges: Edge[];
  savedAt: string;
};

export function saveCanvas(nodes: Node[], edges: Edge[]) {
  try {
    const clean = nodes.map((n) => ({
      ...n,
      data: { ...n.data, isLoading: false, isExpanding: false, hasFailed: false },
    }));
    const state: PersistedState = {
      nodes: clean,
      edges,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable
  }
}

export function loadCanvas(): { nodes: Node[]; edges: Edge[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state: PersistedState = JSON.parse(raw);
    if (!state.nodes?.length) return null;
    return { nodes: state.nodes, edges: state.edges };
  } catch {
    return null;
  }
}

export function clearCanvas() {
  localStorage.removeItem(STORAGE_KEY);
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedSave(nodes: Node[], edges: Edge[]) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => saveCanvas(nodes, edges), DEBOUNCE_MS);
}
