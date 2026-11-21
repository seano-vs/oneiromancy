/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'K' | 'DEF' | 'K_DEF';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface PositionalBadgeProps {
  position: Position | string;
  size?: BadgeSize;
  className?: string;
  depth?: number | string | null;
  title?: string;
}

export const toSuperscript = (depth: number | string | null | undefined): string => {
  if (depth === null || depth === undefined || String(depth).trim() === '') return '';
  const num = Number(depth);
  if (!Number.isInteger(num) || num < 1 || num > 99) return '';
  return String(num);
};

const POSITION_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  QB: {
    text: 'text-rose-300',
    bg: 'bg-zinc-900/90',
    border: 'border-white/10',
  },
  RB: {
    text: 'text-emerald-300',
    bg: 'bg-zinc-900/90',
    border: 'border-white/10',
  },
  WR: {
    text: 'text-sky-300',
    bg: 'bg-zinc-900/90',
    border: 'border-white/10',
  },
  TE: {
    text: 'text-amber-300',
    bg: 'bg-zinc-900/90',
    border: 'border-white/10',
  },
  FLEX: {
    text: 'text-orange-300',
    bg: 'bg-zinc-900/90',
    border: 'border-white/10',
  },
  K: {
    text: 'text-zinc-300',
    bg: 'bg-zinc-900/90',
    border: 'border-white/10',
  },
  DEF: {
    text: 'text-zinc-300',
    bg: 'bg-zinc-900/90',
    border: 'border-white/10',
  },
  K_DEF: {
    text: 'text-zinc-300',
    bg: 'bg-zinc-900/90',
    border: 'border-white/10',
  },
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 rounded font-medium',
  md: 'text-xs px-2 py-0.5 rounded font-medium',
  lg: 'text-xs px-2.5 py-1 rounded font-semibold',
};

export const PositionalBadge: React.FC<PositionalBadgeProps> = ({
  position,
  size = 'md',
  className = '',
  depth,
  title,
}) => {
  const normalizedPos = position.toUpperCase();
  const styles = POSITION_STYLES[normalizedPos] || {
    text: 'text-zinc-300',
    bg: 'bg-zinc-900/90',
    border: 'border-white/10',
  };

  const depthText = toSuperscript(depth);
  const isValidDepth = depthText !== '';

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const badgeTitle = title ?? (isValidDepth ? `${normalizedPos} · depth chart #${depthText}` : undefined);

  return (
    <span
      data-testid={`badge-${normalizedPos.toLowerCase()}`}
      title={badgeTitle}
      className={`inline-flex items-center justify-center font-mono border uppercase tracking-wider transition-all duration-200 ${styles.text} ${styles.bg} ${styles.border} ${sizeClass} ${className}`}
    >
      {normalizedPos}
      {isValidDepth ? (
        <>
          <sup
            data-testid="position-depth"
            aria-hidden="true"
            className="relative -top-[0.35em] text-[0.7em] font-bold leading-none ml-0.5 tracking-tight select-none"
          >
            {depthText}
          </sup>
          <span className="sr-only normal-case">, depth chart {depthText}</span>
        </>
      ) : null}
    </span>
  );
};

export default PositionalBadge;
