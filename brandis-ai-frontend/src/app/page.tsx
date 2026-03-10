'use client';

import { ReactFlowProvider } from '@xyflow/react';
import ExplorationCanvas from '@/components/ExplorationCanvas';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function Home() {
  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <ExplorationCanvas />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}
