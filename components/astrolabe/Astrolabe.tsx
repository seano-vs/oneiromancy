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

'use client';

import React from 'react';
import { ALL_PREDICTOR_SYSTEM_IDS } from '@/lib/oracle';
import { DEFAULT_CHAOS_LAMBDA } from '@/lib/scoring';

export interface AstrolabeProps {
  size?: number;
  speedMultiplier?: number;
  lambda?: number;
  className?: string;
  showCenterReadout?: boolean;
}

export const Astrolabe: React.FC<AstrolabeProps> = ({
  size = 240,
  speedMultiplier,
  lambda = DEFAULT_CHAOS_LAMBDA,
  className = '',
  showCenterReadout = true,
}) => {
  // Compute effective multiplier from speedMultiplier (if explicitly given) or lambda (0.0 to 1.0)
  const mult = speedMultiplier !== undefined 
    ? Math.max(0.1, speedMultiplier) 
    : Math.max(0.2, 1 + (lambda ?? DEFAULT_CHAOS_LAMBDA) * 3);

  // Dynamic animation durations based on rotation speed multiplier
  const outerDuration = Math.max(3, 60 / mult);
  const middleDuration = Math.max(2.5, 40 / mult);
  const innerDuration = Math.max(1.5, 20 / mult);

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      data-testid="astrolabe"
      role="img"
      aria-label={`Celestial Astrolabe with speed multiplier ${mult.toFixed(2)}`}
    >
      <svg
        viewBox="0 0 300 300"
        width={size}
        height={size}
        className="relative overflow-visible"
      >
        {/* Outer Halo */}
        <circle
          cx="150"
          cy="150"
          r="146"
          fill="none"
          stroke="rgba(226,185,100,0.16)"
          strokeWidth="1"
          strokeDasharray="2, 6"
        />

        {/* Ring 1: Outer Zodiac & Celestial Degree Ticks */}
        <g
          data-astrolabe-ring=""
          className="origin-center"
          style={{
            animation: `spin-cw ${outerDuration}s linear infinite`,
            transformOrigin: '150px 150px',
          }}
        >
          <circle
            cx="150"
            cy="150"
            r="138"
            fill="none"
            stroke="rgba(226,185,100,0.45)"
            strokeWidth="1.25"
          />
          <circle
            cx="150"
            cy="150"
            r="130"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
            strokeDasharray="3, 5"
          />
          {Array.from({ length: 24 }).map((_, i) => (
            <line
              key={`tick-${i}`}
              x1="150"
              y1="12"
              x2="150"
              y2={i % 6 === 0 ? '22' : i % 2 === 0 ? '19' : '16'}
              stroke={i % 6 === 0 ? '#e2b964' : i % 2 === 0 ? 'rgba(226,185,100,0.55)' : 'rgba(255,255,255,0.22)'}
              strokeWidth={i % 6 === 0 ? '2' : i % 2 === 0 ? '1.25' : '1'}
              transform={`rotate(${i * 15} 150 150)`}
            />
          ))}
        </g>

        {/* Ring 2: Middle Aspect Chords */}
        <g
          data-astrolabe-ring=""
          className="origin-center"
          style={{
            animation: `spin-ccw ${middleDuration}s linear infinite`,
            transformOrigin: '150px 150px',
          }}
        >
          <circle
            cx="150"
            cy="150"
            r="104"
            fill="none"
            stroke="rgba(167,139,250,0.28)"
            strokeWidth="1"
          />
          <polygon
            points="150,46 240,202 60,202"
            fill="none"
            stroke="rgba(226,185,100,0.34)"
            strokeWidth="1"
          />
          <polygon
            points="150,254 60,98 240,98"
            fill="none"
            stroke="rgba(125,211,252,0.26)"
            strokeWidth="1"
          />
          <circle cx="150" cy="46" r="3" fill="#e2b964" />
          <circle cx="240" cy="202" r="2.5" fill="#c4b5fd" />
          <circle cx="60" cy="202" r="2.5" fill="#7dd3fc" />
        </g>

        {/* Ring 3: Inner Brass Ring */}
        <g
          data-astrolabe-ring=""
          className="origin-center"
          style={{
            animation: `spin-cw ${innerDuration}s linear infinite`,
            transformOrigin: '150px 150px',
          }}
        >
          <circle
            cx="150"
            cy="150"
            r="70"
            fill="none"
            stroke="rgba(226,185,100,0.4)"
            strokeWidth="1"
          />
          <polygon
            points="150,80 210,185 90,185"
            fill="none"
            stroke="rgba(226,185,100,0.22)"
            strokeWidth="1"
          />
        </g>

        {/* Center Core */}
        <circle
          cx="150"
          cy="150"
          r="30"
          fill="#0f1012"
          stroke="rgba(226,185,100,0.5)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Center Readout */}
      {showCenterReadout && (
        <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-[9px] font-mono text-zinc-400 font-medium uppercase tracking-wider">
            {speedMultiplier !== undefined ? 'SPEED' : 'SYS'}
          </span>
          <span className="text-xs font-mono tabular-nums text-amber-200 font-semibold tracking-tight">
            {speedMultiplier !== undefined
              ? `${mult.toFixed(1)}x`
              : String(ALL_PREDICTOR_SYSTEM_IDS.length)}
          </span>
        </div>
      )}
    </div>
  );
};

export default Astrolabe;
