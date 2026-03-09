'use client';

import { allColors, getColorById, type BranchColor } from '@/lib/colors';

type ColorPickerProps = {
  selectedId: string;
  onChange: (colorId: string) => void;
};

export default function ColorPicker({ selectedId, onChange }: ColorPickerProps) {
  return (
    <div className="flex gap-1 items-center nodrag nopan">
      {allColors.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={`w-5 h-5 rounded-full border-2 transition-transform
                      ${c.id === selectedId ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-110'}
                      hover:border-gray-400`}
          style={{ backgroundColor: c.edge }}
          title={c.id}
        />
      ))}
    </div>
  );
}
