export const presetHexColors: string[] = [
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f43f5e', // rose
  '#0ea5e9', // sky
  '#f97316', // orange
  '#10b981', // emerald
  '#ec4899', // pink
  '#6366f1', // indigo
];

export function getNextHex(index: number): string {
  return presetHexColors[index % presetHexColors.length];
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function contrastText(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff';
}

export function tint(hex: string, opacity: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const dr = clamp(r * (1 - amount));
  const dg = clamp(g * (1 - amount));
  const db = clamp(b * (1 - amount));
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}
