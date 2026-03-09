export type BranchColor = {
  id: string;
  bg: string;
  text: string;
  edge: string;
  tag: string;
  tagText: string;
};

const palette: BranchColor[] = [
  { id: 'violet',  bg: 'bg-violet-200',  text: 'text-violet-900',  edge: '#8b5cf6', tag: 'bg-violet-100',  tagText: 'text-violet-800' },
  { id: 'teal',    bg: 'bg-teal-200',    text: 'text-teal-900',    edge: '#14b8a6', tag: 'bg-teal-100',    tagText: 'text-teal-800' },
  { id: 'rose',    bg: 'bg-rose-200',    text: 'text-rose-900',    edge: '#f43f5e', tag: 'bg-rose-100',    tagText: 'text-rose-800' },
  { id: 'sky',     bg: 'bg-sky-200',     text: 'text-sky-900',     edge: '#0ea5e9', tag: 'bg-sky-100',     tagText: 'text-sky-800' },
  { id: 'orange',  bg: 'bg-orange-200',  text: 'text-orange-900',  edge: '#f97316', tag: 'bg-orange-100',  tagText: 'text-orange-800' },
  { id: 'emerald', bg: 'bg-emerald-200', text: 'text-emerald-900', edge: '#10b981', tag: 'bg-emerald-100', tagText: 'text-emerald-800' },
  { id: 'pink',    bg: 'bg-pink-200',    text: 'text-pink-900',    edge: '#ec4899', tag: 'bg-pink-100',    tagText: 'text-pink-800' },
  { id: 'indigo',  bg: 'bg-indigo-200',  text: 'text-indigo-900',  edge: '#6366f1', tag: 'bg-indigo-100',  tagText: 'text-indigo-800' },
];

export const allColors: BranchColor[] = palette;

export function getColor(index: number): BranchColor {
  return palette[index % palette.length];
}

export function getColorById(id: string): BranchColor {
  return palette.find((c) => c.id === id) ?? palette[0];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function getClosestPaletteColor(hex: string): BranchColor {
  const [r, g, b] = hexToRgb(hex);
  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const [cr, cg, cb] = hexToRgb(c.edge);
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}
