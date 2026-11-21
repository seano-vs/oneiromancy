/**
 * @license
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

'use client';

import React, { useMemo } from 'react';

const FIVE_POINT_STAR_POINTS =
  '12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9';

const FOUR_POINT_SPARKLE_PATH =
  'M12 1.5 L14.1 9.9 L22.5 12 L14.1 14.1 L12 22.5 L9.9 14.1 L1.5 12 L9.9 9.9 Z';

interface FloatingStarParticle {
  leftPct: number;
  topPx: number;
  sizePx: number;
  durationSec: number;
  delaySec: number;
  bright: boolean;
}

interface AuraStarParticle {
  leftPct: number;
  topPct: number;
  sizePx: number;
  durationSec: number;
  delaySec: number;
  toneIdx: 0 | 1 | 2;
  fourPoint: boolean;
  floatUp: boolean;
}

function createSeededRng(seedKey: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    hash ^= seedKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return (hash >>> 0) / 4294967296;
  };
}

function buildFloatingStars(seedKey: string): FloatingStarParticle[] {
  const nextRand = createSeededRng(seedKey);
  return Array.from({ length: 6 }, (_, i) => ({
    leftPct: Math.round(6 + ((i + nextRand() * 0.8) / 6) * 82),
    topPx: Math.round(-5 + nextRand() * 11),
    sizePx: Math.round(8 + nextRand() * 4),
    durationSec: Number((1.9 + nextRand() * 1.1).toFixed(2)),
    delaySec: Number((-0.15 - i * 0.32 - nextRand() * 0.2).toFixed(2)),
    bright: i % 2 === 1,
  }));
}

function buildAuraStars(seedKey: string, count: number): AuraStarParticle[] {
  const nextRand = createSeededRng(`aura:${seedKey}`);
  return Array.from({ length: count }, (_, i) => {
    // Spread across the width while keeping top/bottom edge bias so text remains crisp
    const slotPct = ((i + 0.15 + nextRand() * 0.7) / count) * 92 + 4;
    const edgeBand = i % 3 === 0 ? 8 + nextRand() * 22 : i % 3 === 1 ? 66 + nextRand() * 24 : 18 + nextRand() * 60;
    return {
      leftPct: Math.round(slotPct * 10) / 10,
      topPct: Math.round(edgeBand * 10) / 10,
      sizePx: Math.round(6 + nextRand() * 6),
      durationSec: Number((2.2 + nextRand() * 1.8).toFixed(2)),
      delaySec: Number((-0.25 - i * 0.37 - nextRand() * 0.3).toFixed(2)),
      toneIdx: (i % 3) as 0 | 1 | 2,
      fourPoint: i % 2 === 0,
      floatUp: i % 3 === 2,
    };
  });
}

export interface PowerupStarsProps {
  seedKey: string;
  isUserTeam: boolean;
}

export const PowerupStars: React.FC<PowerupStarsProps> = ({ seedKey, isUserTeam }) => {
  const floatingStars = useMemo(() => buildFloatingStars(seedKey), [seedKey]);

  return (
    <div
      data-testid="oracle-powerup-stars"
      aria-hidden="true"
      className="pointer-events-none absolute -top-2.5 -inset-x-1.5 h-6 overflow-visible"
    >
      {floatingStars.map((star, idx) => (
        <svg
          key={idx}
          viewBox="0 0 24 24"
          width={star.sizePx}
          height={star.sizePx}
          style={{
            left: `${star.leftPct}%`,
            top: `${star.topPx}px`,
            animationDuration: `${star.durationSec}s`,
            animationDelay: `${star.delaySec}s`,
          }}
          className={`absolute animate-powerup-star-float motion-reduce:animate-none ${
            isUserTeam
              ? star.bright
                ? 'text-amber-200 drop-shadow-[0_0_5px_rgba(245,214,142,0.85)]'
                : 'text-violet-200 drop-shadow-[0_0_4px_rgba(196,181,253,0.75)]'
              : star.bright
                ? 'text-sky-100 drop-shadow-[0_0_5px_rgba(186,230,253,0.85)]'
                : 'text-sky-300 drop-shadow-[0_0_4px_rgba(125,211,252,0.75)]'
          }`}
        >
          <polygon points={FIVE_POINT_STAR_POINTS} fill="currentColor" />
        </svg>
      ))}
    </div>
  );
};

export interface LeaderStarryAuraProps {
  seedKey: string;
  isUserTeam: boolean;
  count?: number;
}

/**
 * Twinkling and floating starfield aura rendered across the card of the
 * higher-scoring player or team in a head-to-head matchup.
 */
export const LeaderStarryAura: React.FC<LeaderStarryAuraProps> = ({
  seedKey,
  isUserTeam,
  count = 10,
}) => {
  const stars = useMemo(() => buildAuraStars(seedKey, count), [seedKey, count]);

  return (
    <div
      data-testid="leader-starry-aura"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      {stars.map((star, idx) => {
        const colorCls = isUserTeam
          ? star.toneIdx === 0
            ? 'text-amber-200/90 drop-shadow-[0_0_5px_rgba(245,214,142,0.8)]'
            : star.toneIdx === 1
              ? 'text-violet-200/85 drop-shadow-[0_0_5px_rgba(196,181,253,0.75)]'
              : 'text-white/85 drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]'
          : star.toneIdx === 0
            ? 'text-sky-200/90 drop-shadow-[0_0_5px_rgba(125,211,252,0.8)]'
            : star.toneIdx === 1
              ? 'text-indigo-200/85 drop-shadow-[0_0_5px_rgba(165,180,252,0.75)]'
              : 'text-white/85 drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]';
        return (
          <svg
            key={idx}
            viewBox="0 0 24 24"
            width={star.sizePx}
            height={star.sizePx}
            style={{
              left: `${star.leftPct}%`,
              top: `${star.topPct}%`,
              animationDuration: `${star.durationSec}s`,
              animationDelay: `${star.delaySec}s`,
            }}
            className={`absolute ${
              star.floatUp ? 'animate-powerup-star-float' : 'animate-star-twinkle'
            } motion-reduce:animate-none ${colorCls}`}
          >
            {star.fourPoint ? (
              <path d={FOUR_POINT_SPARKLE_PATH} fill="currentColor" />
            ) : (
              <polygon points={FIVE_POINT_STAR_POINTS} fill="currentColor" />
            )}
          </svg>
        );
      })}
    </div>
  );
};

export default PowerupStars;
