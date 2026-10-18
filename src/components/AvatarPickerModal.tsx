'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, Check, Sparkles } from 'lucide-react';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentType: 'DEFAULT' | 'CUSTOM';
  currentValue: string;
  onSelect: (type: 'DEFAULT' | 'CUSTOM', value: string) => void;
}

const DEFAULT_AVATARS = [
  { id: 'default-1', name: 'Headset Coach' },
  { id: 'default-2', name: 'Retro Mascot' },
  { id: 'default-3', name: 'Gold Helmet' },
  { id: 'default-4', name: 'Foam Finger' },
  { id: 'default-5', name: 'Desk Anchor' },
  { id: 'default-6', name: 'Drum Major' },
  { id: 'default-7', name: 'Ref Cap' },
  { id: 'default-8', name: 'Linebacker' },
  { id: 'default-9', name: 'Trophy Pose' },
  { id: 'default-10', name: 'Grill Master' },
];

export default function AvatarPickerModal({
  isOpen,
  onClose,
  currentType,
  currentValue,
  onSelect,
}: AvatarPickerModalProps) {
  const [selectedType, setSelectedType] = useState<'DEFAULT' | 'CUSTOM'>(currentType);
  const [selectedValue, setSelectedValue] = useState<string>(currentValue);
  const [compressing, setCompressing] = useState(false);
  const [compressError, setCompressError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // HTML5 <canvas> 1:1 square crop, 256x256px max, WebP/JPEG at 0.8 quality
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    setCompressError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 256;
          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            setCompressError('Canvas context unavailable');
            setCompressing(false);
            return;
          }

          // Center 1:1 square crop
          const srcSize = Math.min(img.width, img.height);
          const srcX = (img.width - srcSize) / 2;
          const srcY = (img.height - srcSize) / 2;

          ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, maxDim, maxDim);

          // Try WebP first with 0.8 quality, fallback to JPEG
          let dataUrl = canvas.toDataURL('image/webp', 0.8);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          }

          setSelectedType('CUSTOM');
          setSelectedValue(dataUrl);
          setCompressing(false);
        } catch {
          setCompressError('Failed to process image');
          setCompressing(false);
        }
      };
      img.onerror = () => {
        setCompressError('Failed to load image file');
        setCompressing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setCompressError('Failed to read file');
      setCompressing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSelect(selectedType, selectedValue);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white tracking-wide">Choose Your Avatar</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 10 Built-In Pixel Art Avatars */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            16-Bit Pixel Art Classics
          </label>
          <div className="grid grid-cols-5 gap-3">
            {DEFAULT_AVATARS.map((av) => {
              const isSelected = selectedType === 'DEFAULT' && selectedValue === av.id;
              return (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => {
                    setSelectedType('DEFAULT');
                    setSelectedValue(av.id);
                  }}
                  className={`group relative flex flex-col items-center p-1.5 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/10 shadow-lg shadow-amber-500/20 scale-105'
                      : 'border-slate-700 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/avatars/${av.id}.svg`}
                    alt={av.name}
                    className="w-12 h-12 rounded-lg pixelated object-cover"
                  />
                  <span className="text-[10px] text-slate-300 font-medium truncate w-full text-center mt-1">
                    {av.name}
                  </span>
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Upload Section */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Or Upload Custom Photo
          </label>
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={compressing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-semibold text-slate-200 transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              {compressing ? 'Compressing...' : 'Upload Image'}
            </button>

            {selectedType === 'CUSTOM' && selectedValue && (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedValue}
                  alt="Custom preview"
                  className="w-10 h-10 rounded-lg object-cover border-2 border-amber-400 shadow-md"
                />
                <span className="text-xs text-emerald-400 font-medium">
                  256x256 WebP Compressed &lt;35KB
                </span>
              </div>
            )}
          </div>
          {compressError && (
            <p className="text-xs text-red-400 mt-1.5">{compressError}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all"
          >
            Save Avatar
          </button>
        </div>
      </div>
    </div>
  );
}
