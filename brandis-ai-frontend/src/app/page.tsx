'use client';

import { ReactFlowProvider } from '@xyflow/react';
import ExplorationCanvas from '@/components/ExplorationCanvas';

export default function Home() {
  return (
    <ReactFlowProvider>
      <ExplorationCanvas />
    </ReactFlowProvider>
  );
}
