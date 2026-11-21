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
import GlassCard from '@/components/common/GlassCard';
import { TeamLogo } from '@/components/common/PlayerHeadshot';

export interface TelemetryBarProps {
  totalProjectedPoints?: number;
  totalVOR?: number;
  elementalDistribution?: {
    Fire: number;
    Earth: number;
    Air: number;
    Water: number;
  };
  activeStacks?: {
    team: string;
    multiplier: number;
    bonusPoints?: number;
    bonus_points?: number;
    description?: string;
    type?: string;
    qb_name?: string;
    pass_catcher_names?: string[];
  }[];
  className?: string;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  totalProjectedPoints = 898.6,
  totalVOR = 211.3,
  elementalDistribution = { Fire: 2, Earth: 1, Air: 1, Water: 3 },
  activeStacks = [
    {
      team: 'CIN',
      multiplier: 3.0,
      bonus_points: 18.0,
      description: 'CIN 3.0x QB/WR Stack (+18.0 pts)',
      qb_name: 'Joe Burrow',
      pass_catcher_names: ["Ja'Marr Chase"],
    },
  ],
  className = '',
}) => {
  // Elemental resonance calculation
  const fire = elementalDistribution.Fire ?? 0;
  const earth = elementalDistribution.Earth ?? 0;
  const air = elementalDistribution.Air ?? 0;
  const water = elementalDistribution.Water ?? 0;

  const hasQuadBalance = fire >= 1 && earth >= 1 && air >= 1 && water >= 1;
  const trines: { name: string; bonus: number }[] = [];
  if (water >= 3) trines.push({ name: 'Water Trine', bonus: water >= 4 ? 18.0 : 12.0 });
  if (fire >= 3) trines.push({ name: 'Fire Trine', bonus: fire >= 4 ? 18.0 : 12.0 });
  if (earth >= 3) trines.push({ name: 'Earth Trine', bonus: earth >= 4 ? 18.0 : 12.0 });
  if (air >= 3) trines.push({ name: 'Air Trine', bonus: air >= 4 ? 18.0 : 12.0 });

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 w-full ${className}`}>
      <GlassCard variant="panel" className="p-3.5 flex flex-col justify-between">
        <span className="text-xs font-sans text-zinc-400">Projected Output</span>
        <div className="my-1">
          <span className="font-mono tabular-nums text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight">
            {totalProjectedPoints.toFixed(1)}
          </span>
          <span className="text-xs font-sans text-zinc-400 ml-1">pts</span>
        </div>
        <span className="text-[11px] font-sans text-zinc-400 truncate">Total Expected PPR</span>
      </GlassCard>

      <GlassCard variant="panel" className="p-3.5 flex flex-col justify-between">
        <span className="text-xs font-sans text-zinc-400">Total VOR</span>
        <div className="my-1">
          <span className="font-mono tabular-nums text-xl sm:text-2xl font-semibold text-emerald-300 tracking-tight">
            {totalVOR >= 0 ? `+${totalVOR.toFixed(1)}` : totalVOR.toFixed(1)}
          </span>
          <span className="text-xs font-sans text-zinc-400 ml-1">VOR</span>
        </div>
        <span className="text-[11px] font-sans text-zinc-400 truncate">Value Over Replacement</span>
      </GlassCard>

      <GlassCard variant="panel" className="p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-sans text-zinc-400">Elements</span>
          <span className="text-[11px] font-sans text-zinc-400">Trines</span>
        </div>
        <div className="my-1 flex items-center justify-between text-xs font-mono tabular-nums text-zinc-200">
          <span title="Fire">F {fire}</span>
          <span title="Earth">E {earth}</span>
          <span title="Air">A {air}</span>
          <span title="Water">W {water}</span>
        </div>
        <div className="truncate text-[11px] font-sans text-zinc-300">
          {trines.length > 0
            ? `${trines[0].name} (+${trines[0].bonus})`
            : hasQuadBalance
            ? 'Quad-Balance (+10.0)'
            : 'Seeking Trine (3x)'}
        </div>
      </GlassCard>

      <GlassCard variant="panel" className="p-3.5 flex flex-col justify-between">
        <span className="text-xs font-sans text-zinc-400">Active Stacks</span>
        <div className="my-1">
          {activeStacks.length > 0 ? (
            <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
              <span className="text-lg sm:text-xl font-semibold text-amber-300">
                <TeamLogo team={activeStacks[0].team} className="mr-1.5" />
                {activeStacks[0].team} {activeStacks[0].multiplier.toFixed(1)}x
              </span>
              <span className="text-[11px] text-emerald-300">
                (+{(activeStacks[0].bonus_points ?? (activeStacks[0] as any).bonusPoints ?? 18.0).toFixed(1)})
              </span>
            </div>
          ) : (
            <span className="font-sans text-sm text-zinc-400 block py-1">No Stacks</span>
          )}
        </div>
        <span className="text-[11px] font-sans text-zinc-400 truncate">
          {activeStacks.length > 0
            ? activeStacks[0].description || `${activeStacks[0].qb_name || 'QB'} stack`
            : 'QB/WR correlation'}
        </span>
      </GlassCard>
    </div>
  );
};

export default TelemetryBar;
