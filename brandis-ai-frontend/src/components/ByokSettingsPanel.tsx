'use client';

import { useCallback, useEffect, useState } from 'react';
import { Panel } from '@xyflow/react';

import { getStoredOpenAIApiKey, setStoredOpenAIApiKey } from '@/lib/byok';

type Props = {
  /** Called after save or clear so callers can retry AI bootstrap (e.g. spark question). */
  onKeyChange?: () => void;
};

export default function ByokSettingsPanel({ onKeyChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);

  useEffect(() => {
    const existing = getStoredOpenAIApiKey();
    setHasStoredKey(!!existing);
    setDraft(existing ?? '');
  }, []);

  const save = useCallback(() => {
    const trimmed = draft.trim();
    setStoredOpenAIApiKey(trimmed || null);
    setHasStoredKey(!!trimmed);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
    onKeyChange?.();
  }, [draft, onKeyChange]);

  const clearKey = useCallback(() => {
    setDraft('');
    setStoredOpenAIApiKey(null);
    setHasStoredKey(false);
    onKeyChange?.();
  }, [onKeyChange]);

  return (
    <Panel position="bottom-left" className="!mb-3 !ml-3">
      <div className="rounded-xl border border-gray-200 bg-white/95 shadow-lg backdrop-blur text-xs max-w-[min(22rem,calc(100vw-1.5rem))]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
          aria-expanded={open}
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${hasStoredKey ? 'bg-emerald-500' : 'bg-amber-400'}`}
            title={hasStoredKey ? 'Browser-stored key set' : 'No browser-stored key'}
          />
          <span className="font-medium">OpenAI API key</span>
          <span className="ml-auto text-gray-400">{open ? '▾' : '▸'}</span>
        </button>

        {open && (
          <div className="border-t border-gray-100 px-3 pb-3 pt-1 space-y-2 text-gray-600">
            <p>
              Your key stays in this browser and is sent only to this app&apos;s server routes—not baked into
              the page. For local development you can use{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">OPENAI_API_KEY</code>{' '}
              instead.
            </p>
            <input
              type="password"
              autoComplete="off"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                className="rounded-lg bg-gray-900 px-3 py-1.5 font-medium text-white hover:bg-gray-800 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={clearKey}
                disabled={!hasStoredKey && !draft}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Clear
              </button>
              {savedFlash && <span className="text-emerald-600 self-center">Saved</span>}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
