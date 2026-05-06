import type { Node, Edge } from '@xyflow/react';

import type { CanvasGraphCommand } from '@/hooks/canvasGraphCommands';
import type { CanvasRevisionTimeline } from '@/hooks/canvasRevisionTimeline';

/** Legacy single-snapshot key (prd-task-graph C migration). */
const LEGACY_STORAGE_KEY = 'brandis-canvas-state';

const REGISTRY_KEY = 'brandis-canvas-registry-v1';

function canvasDocKey(canvasId: string) {
  return `brandis-canvas-doc-v1:${canvasId}`;
}

const DEBOUNCE_MS = 1000;

export type CanvasMeta = {
  id: string;
  name: string;
  updatedAt: string;
};

export type CanvasRegistryV1 = {
  version: 1;
  activeCanvasId: string;
  canvases: CanvasMeta[];
};

export type PersistedCanvasDocumentV1 = {
  version: 1;
  savedAt: string;
  timeline: CanvasRevisionTimeline;
};

type LegacyPersistedState = {
  nodes: Node[];
  edges: Edge[];
  savedAt?: string;
};

function newCanvasId(): string {
  return crypto.randomUUID();
}

function normalizeLoadedNode(node: Node): Node {
  if (node.type !== 'qa') return node;
  const data = node.data as Record<string, unknown>;
  const rev = data.answerRevisions;
  if (Array.isArray(rev)) return node;
  return { ...node, data: { ...data, answerRevisions: [] } };
}

function stripNodeRuntimeFlags(node: Node): Node {
  const data = node.data as Record<string, unknown>;
  return {
    ...node,
    data: {
      ...data,
      isLoading: false,
      isExpanding: false,
      hasFailed: false,
    },
  };
}

function timelineFromLegacySnapshot(nodes: Node[], edges: Edge[]): CanvasRevisionTimeline {
  const normalizedNodes = nodes.map(normalizeLoadedNode).map(stripNodeRuntimeFlags);
  const cmd: CanvasGraphCommand = {
    kind: 'set-graph',
    nodes: normalizedNodes,
    edges: edges ?? [],
  };
  return {
    entries: [
      {
        id: crypto.randomUUID(),
        parentRevisionId: null,
        createdAt: new Date().toISOString(),
        command: cmd,
      },
    ],
    headIndex: 0,
  };
}

function emptyRegistryWithCanvas(name: string): CanvasRegistryV1 {
  const id = newCanvasId();
  return {
    version: 1,
    activeCanvasId: id,
    canvases: [{ id, name, updatedAt: new Date().toISOString() }],
  };
}

export function readRegistry(): CanvasRegistryV1 | null {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CanvasRegistryV1;
    if (parsed?.version !== 1 || !Array.isArray(parsed.canvases) || !parsed.activeCanvasId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeRegistry(registry: CanvasRegistryV1) {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // quota / unavailable
  }
}

/** Ensure registry + at least one canvas; migrate legacy single-key snapshot if present. */
export function ensureCanvasRegistry(): CanvasRegistryV1 {
  let registry = readRegistry();
  if (registry) return registry;

  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const state = JSON.parse(legacyRaw) as LegacyPersistedState;
      if (state.nodes?.length) {
        const id = newCanvasId();
        registry = {
          version: 1,
          activeCanvasId: id,
          canvases: [
            {
              id,
              name: 'Imported',
              updatedAt: new Date().toISOString(),
            },
          ],
        };
        writeRegistry(registry);
        const timeline = timelineFromLegacySnapshot(state.nodes, state.edges);
        const doc: PersistedCanvasDocumentV1 = {
          version: 1,
          savedAt: new Date().toISOString(),
          timeline,
        };
        try {
          localStorage.setItem(canvasDocKey(id), JSON.stringify(doc));
        } catch {
          /* ignore */
        }
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return registry;
      }
    }
  } catch {
    /* ignore */
  }

  registry = emptyRegistryWithCanvas('Untitled');
  writeRegistry(registry);
  return registry;
}

export function loadCanvasDocument(canvasId: string): PersistedCanvasDocumentV1 | null {
  try {
    const raw = localStorage.getItem(canvasDocKey(canvasId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCanvasDocumentV1;
    if (parsed?.version !== 1 || !parsed.timeline) return null;
    return parsed;
  } catch {
    return null;
  }
}

function touchCanvasUpdatedAt(registry: CanvasRegistryV1, canvasId: string) {
  const meta = registry.canvases.find((c) => c.id === canvasId);
  if (meta) meta.updatedAt = new Date().toISOString();
}

export function saveCanvasDocument(canvasId: string, timeline: CanvasRevisionTimeline) {
  try {
    const doc: PersistedCanvasDocumentV1 = {
      version: 1,
      savedAt: new Date().toISOString(),
      timeline,
    };
    localStorage.setItem(canvasDocKey(canvasId), JSON.stringify(doc));
    const registry = readRegistry();
    if (registry) {
      touchCanvasUpdatedAt(registry, canvasId);
      writeRegistry(registry);
    }
  } catch {
    // quota / unavailable
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pending: { canvasId: string; timeline: CanvasRevisionTimeline } | null = null;

export function flushPendingCanvasSave() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (pending) {
    saveCanvasDocument(pending.canvasId, pending.timeline);
    pending = null;
  }
}

export function debouncedSaveCanvas(canvasId: string, timeline: CanvasRevisionTimeline) {
  pending = { canvasId, timeline };
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (pending) saveCanvasDocument(pending.canvasId, pending.timeline);
    pending = null;
  }, DEBOUNCE_MS);
}

export function setActiveCanvasIdInRegistry(canvasId: string) {
  const registry = readRegistry();
  if (!registry) return;
  if (!registry.canvases.some((c) => c.id === canvasId)) return;
  registry.activeCanvasId = canvasId;
  writeRegistry(registry);
}

/** Empty timeline persisted so returning to a new canvas restores a blank map. */
export function appendNewCanvas(name: string): CanvasRegistryV1 {
  let registry = readRegistry();
  if (!registry) registry = ensureCanvasRegistry();
  const id = newCanvasId();
  const meta: CanvasMeta = { id, name, updatedAt: new Date().toISOString() };
  registry.canvases.push(meta);
  registry.activeCanvasId = id;
  writeRegistry(registry);
  const emptyTimeline: CanvasRevisionTimeline = { entries: [], headIndex: -1 };
  saveCanvasDocument(id, emptyTimeline);
  return registry;
}

export function updateCanvasName(canvasId: string, name: string) {
  const registry = readRegistry();
  if (!registry) return;
  const meta = registry.canvases.find((c) => c.id === canvasId);
  if (!meta) return;
  meta.name = name;
  meta.updatedAt = new Date().toISOString();
  writeRegistry(registry);
}
