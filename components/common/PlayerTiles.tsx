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

/**
 * Shared visual primitives (colored tags, Base + Modifier stat tiles, element icons),
 * driven strictly by next-game Base projected points and the combined 25-predictor Modifier.
 */

import React from 'react';
import { Droplet, Flame, Mountain, Wind } from 'lucide-react';
import OraclePlaceholderMarker from '@/components/common/OraclePlaceholderMarker';
import {
  formatSignedModifier,
  modifierTextColor,
  oraclePlaceholderInfo,
  playerForecast,
  resolveActiveWeek,
} from '@/lib/oracle';
import { isPlayerOnByeWeek } from '@/lib/scoring';
import { getSeasonContext } from '@/lib/sleeper';
import { useOptionalOneiromancy } from '@/context/OneiromancyContext';
import type { CosmicPlayer } from '@/types/oneiromancy';

export const ElementIcon: React.FC<{ element?: string | null }> = ({ element }) => {
  switch (element) {
    case 'Fire':
      return <Flame className="w-3 h-3 text-zinc-400 inline shrink-0" />;
    case 'Water':
      return <Droplet className="w-3 h-3 text-zinc-400 inline shrink-0" />;
    case 'Air':
      return <Wind className="w-3 h-3 text-zinc-400 inline shrink-0" />;
    case 'Earth':
      return <Mountain className="w-3 h-3 text-zinc-400 inline shrink-0" />;
    default:
      return null;
  }
};

export type TagTone = 'emerald' | 'rose' | 'amber' | 'slate';
const TAG: Record<TagTone, string> = {
  emerald: 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300',
  rose: 'bg-rose-950/50 border-rose-500/30 text-rose-300',
  amber: 'bg-amber-950/50 border-amber-500/30 text-amber-300',
  slate: 'bg-zinc-900 border-white/10 text-zinc-400',
};

/** Small status pill (injury, priority, role). */
export const Tag: React.FC<{ tone: TagTone; children: React.ReactNode; className?: string }> = ({
  tone,
  children,
  className = '',
}) => (
  <span
    className={`px-1.5 py-0.5 rounded border font-sans text-[10px] font-medium whitespace-nowrap ${TAG[tone]} ${className}`}
  >
    {children}
  </span>
);

/** Injury tag; "Healthy" when clear, or "BYE WK N" when on bye. */
export const HealthTag: React.FC<{ player: CosmicPlayer; activeWeek?: number }> = ({
  player,
  activeWeek,
}) => {
  const s = player.injury_status;
  const severe = Boolean(s && ['Out', 'IR', 'NA', 'PUP', 'Sus', 'Doubtful'].includes(s));
  const ctx = getSeasonContext();
  const oneiromancy = useOptionalOneiromancy();
  const activeWk = resolveActiveWeek(oneiromancy?.draftState, activeWeek);
  const onBye = isPlayerOnByeWeek(activeWk, player.bye_week, player.team, ctx?.byeWeeks);

  const byeBadge = onBye ? (
    <span className="inline-flex items-center gap-1.5">
      <Tag tone="amber">{`BYE WK ${player.bye_week || activeWk}`}</Tag>
      <span className="text-[10px] font-sans text-zinc-400">On Bye</span>
    </span>
  ) : null;

  if (s && severe) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Tag tone="rose">{s}</Tag>
        {byeBadge}
      </span>
    );
  }
  if (s && s !== 'Healthy') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Tag tone="amber">{s}</Tag>
        {byeBadge}
      </span>
    );
  }
  if (onBye) {
    return byeBadge;
  }
  return <span className="text-[10px] font-sans font-medium text-zinc-400">Healthy</span>;
};

/** A signed delta badge such as "+1.8 PTS". */
export const DeltaBadge: React.FC<{
  value: number;
  unit: string;
  tone: TagTone;
  digits?: number;
}> = ({ value, unit, tone, digits = 1 }) => (
  <span className={`px-2 py-0.5 rounded border font-mono tabular-nums text-[10px] font-bold ${TAG[tone]}`}>
    {value >= 0 ? '+' : ''}
    {value.toFixed(digits)} {unit}
  </span>
);

/**
 * 2-Metric Stat tiles:
 * 1. Base (Sleeper projected points for next game)
 * 2. Modifier (Combined +/- point differential across active predictive systems)
 */
export const StatTiles: React.FC<{
  player: CosmicPlayer;
  lambda?: number;
  muted?: boolean;
  activeWeek?: number;
}> = ({ player, muted = false, activeWeek }) => {
  const oneiromancy = useOptionalOneiromancy();
  const activeWk = resolveActiveWeek(oneiromancy?.draftState, activeWeek);
  const placeholder = oraclePlaceholderInfo(player, activeWk);
  const forecast = playerForecast(player, {
    currentWeek: activeWk,
    enabledSystems: oneiromancy?.enabledSystems,
    placeholder: true,
    nextGameLookahead: true,
  });

  return (
    <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06] text-xs font-mono tabular-nums">
      <span
        className="text-zinc-400"
        title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : 'Sleeper projected points for next game'}
      >
        <span className="font-sans text-zinc-400 mr-1.5">Base</span>
        <span className="text-zinc-200 font-semibold inline-flex items-center">
          {forecast.basePts.toFixed(1)}
          {placeholder.hasPlaceholder && (
            <OraclePlaceholderMarker placeholder={placeholder} kind="stats" />
          )}
        </span>
      </span>
      <span
        className="text-zinc-400"
        title="Combined +/- point differential across active prediction systems"
      >
        <span className="font-sans text-zinc-400 mr-1.5">Mod</span>
        <span
          className={`font-semibold ${
            muted ? 'text-zinc-300' : modifierTextColor(forecast.overallModifierPts)
          }`}
        >
          {formatSignedModifier(forecast.overallModifierPts)}
        </span>
      </span>
      <span
        data-testid="stat-tile-projected"
        className="text-zinc-400"
        title="Projected net points (Base + Modifier)"
      >
        <span className="font-sans text-amber-200/90 mr-1.5">Projected</span>
        <span className={`font-semibold inline-flex items-center ${muted ? 'text-zinc-200' : 'text-amber-200'}`}>
          {forecast.adjustedPts.toFixed(1)}
          {placeholder.hasPlaceholder && (
            <OraclePlaceholderMarker placeholder={placeholder} />
          )}
        </span>
      </span>
    </div>
  );
};
