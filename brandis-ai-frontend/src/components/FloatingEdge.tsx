'use client';

import { useCallback } from 'react';
import {
  BaseEdge,
  useInternalNode,
  type EdgeProps,
} from '@xyflow/react';

function getNodeCenter(node: { position: { x: number; y: number }; measured?: { width?: number; height?: number } }) {
  const w = node.measured?.width ?? 380;
  const h = node.measured?.height ?? 200;
  return {
    x: node.position.x + w / 2,
    y: node.position.y + h / 2,
    w,
    h,
  };
}

function getEdgePoints(
  source: { position: { x: number; y: number }; measured?: { width?: number; height?: number } },
  target: { position: { x: number; y: number }; measured?: { width?: number; height?: number } }
) {
  const s = getNodeCenter(source);
  const t = getNodeCenter(target);

  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const angle = Math.atan2(dy, dx);

  const pad = 2;

  function borderPoint(cx: number, cy: number, w: number, h: number, a: number) {
    const hw = w / 2 + pad;
    const hh = h / 2 + pad;
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    const scaleX = cos !== 0 ? hw / Math.abs(cos) : Infinity;
    const scaleY = sin !== 0 ? hh / Math.abs(sin) : Infinity;
    const scale = Math.min(scaleX, scaleY);

    return {
      x: cx + cos * scale,
      y: cy + sin * scale,
    };
  }

  const sourcePoint = borderPoint(s.x, s.y, s.w, s.h, angle);
  const targetPoint = borderPoint(t.x, t.y, t.w, t.h, angle + Math.PI);

  return { sourcePoint, targetPoint };
}

export default function FloatingEdge({
  id,
  source,
  target,
  style,
  markerEnd,
  markerStart,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const { sourcePoint, targetPoint } = getEdgePoints(sourceNode, targetNode);

  const mx = (sourcePoint.x + targetPoint.x) / 2;
  const my = (sourcePoint.y + targetPoint.y) / 2;

  const path = `M ${sourcePoint.x},${sourcePoint.y} Q ${mx},${my} ${targetPoint.x},${targetPoint.y}`;

  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
      markerEnd={markerEnd}
      markerStart={markerStart}
    />
  );
}
