'use client';

import { useRef } from 'react';
import { presetHexColors } from '@/lib/colors';

type ColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
};

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex gap-1 items-center nodrag nopan">
      {presetHexColors.map((hex) => (
        <button
          key={hex}
          onClick={() => onChange(hex)}
          className={`w-5 h-5 rounded-full border-2 transition-transform
                      ${hex === value ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-110'}
                      hover:border-gray-400`}
          style={{ backgroundColor: hex }}
        />
      ))}
      <button
        onClick={() => inputRef.current?.click()}
        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110
                    ${!presetHexColors.includes(value) ? 'border-gray-800 scale-110' : 'border-gray-300'}
                    bg-gradient-to-br from-red-400 via-green-400 to-blue-400`}
        title="Custom color"
      />
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
    </div>
  );
}
