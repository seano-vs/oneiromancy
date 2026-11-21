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

import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import GlassCard from '@/components/common/GlassCard';
import OraclePlaceholderMarker from '@/components/common/OraclePlaceholderMarker';
import { TeamLogo } from '@/components/common/PlayerHeadshot';
import { ElementIcon } from '@/components/common/PlayerTiles';
import PositionalBadge from '@/components/common/PositionalBadge';
import { useOptionalOneiromancy } from '@/context/OneiromancyContext';
import {
  buildUnitMap,
  formatSignedModifier,
  modifierTextColor,
  oraclePlaceholderInfo,
  playerForecast,
  resolveActiveWeek,
} from '@/lib/oracle';
import { CosmicPlayer } from '@/types/oneiromancy';

export interface RecommendedPickHeroProps {
  player: CosmicPlayer | null;
  onDraft?: (playerId: string) => void;
  onInspect?: (player: CosmicPlayer) => void;
  onSelectPlayer?: (player: CosmicPlayer) => void;
  isDrafting?: boolean;
  className?: string;
  activeWeek?: number;
}

export const RecommendedPickHero: React.FC<RecommendedPickHeroProps> = ({
  player,
  onInspect,
  onSelectPlayer,
  className = '',
  activeWeek: propActiveWeek,
}) => {
  const ctx = useOptionalOneiromancy();
  const activeWeek = resolveActiveWeek(ctx?.draftState, propActiveWeek);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const unitByTeam = useMemo(
    () =>
      ctx?.draftState?.cosmic_board?.length
        ? buildUnitMap(ctx.draftState.cosmic_board, ctx.draftState.my_roster ?? [])
        : undefined,
    [ctx?.draftState?.cosmic_board, ctx?.draftState?.my_roster],
  );

  const handleSelectPlayer = () => {
    if (!player) return;
    if (onSelectPlayer) {
      onSelectPlayer(player);
    } else if (onInspect) {
      onInspect(player);
    }
  };

  if (!player) {
    return (
      <GlassCard variant="panel" className={`p-8 text-center space-y-2 ${className}`}>
        <p className="text-sm font-sans text-zinc-300">
          All candidates drafted.
        </p>
      </GlassCard>
    );
  }

  const forecast = playerForecast(player, {
    currentWeek: activeWeek,
    enabledSystems: ctx?.enabledSystems,
    unitByTeam,
    placeholder: true,
    nextGameLookahead: true,
  });
  const placeholder = oraclePlaceholderInfo(player, activeWeek);
  const enabledSystems = forecast.systems.filter((s) => s.enabled);
  const activePredictorCount = enabledSystems.length;
  const topSystems = [...enabledSystems]
    .sort((a, b) => Math.abs(b.jointContributionPts) - Math.abs(a.jointContributionPts))
    .slice(0, 6);

  return (
    <GlassCard
      variant="panel"
      className={`p-5 sm:p-6 relative overflow-hidden ${className}`}
    >
      <div className="flex justify-between items-center border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <PositionalBadge position={player.position} size="md" depth={player.depth_chart_order} />
          <span className="text-xs font-sans text-zinc-300 inline-flex items-center gap-1.5">
            <ElementIcon element={player.elemental_traits?.element} />
            <span>{player.elemental_traits?.element || 'Celestial'} · {player.elemental_traits?.sun_sign || 'Astra'}</span>
          </span>
        </div>
        <span className="text-xs font-sans font-medium text-amber-300">
          Top Recommendation
        </span>
      </div>

      <div className="mt-4 space-y-1">
        <h3 className="font-sans text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">
          <button
            type="button"
            onClick={handleSelectPlayer}
            data-testid="spotlight-player-name"
            className="text-left cursor-pointer hover:underline hover:text-amber-200 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/70 rounded-xs"
            title={`Click to open ${player.name} details`}
          >
            {player.name}
          </button>
        </h3>
        <p className="font-mono tabular-nums text-xs text-zinc-400 flex flex-wrap gap-2 items-center">
          <span>
            <TeamLogo team={player.team} className="mr-1" />
            {player.team}
          </span>
          <span>·</span>
          <span>Bye {player.bye_week || '-'}</span>
          <span>·</span>
          <span>#{player.jersey_number}</span>
        </p>
      </div>

      {/* Base, Overall Modifier & Projected */}
      <div className="mt-4 grid grid-cols-3 divide-x divide-white/[0.08] border-y border-white/[0.08] py-3">
        <div className="pr-3 sm:pr-4 flex flex-col">
          <span className="text-xs font-sans text-zinc-400">Base</span>
          <span
            title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : undefined}
            className="font-mono text-xl sm:text-2xl font-semibold text-zinc-100 tabular-nums inline-flex items-baseline gap-1"
          >
            <span>{forecast.basePts.toFixed(1)}</span>
            <span className="text-xs font-normal text-zinc-400">pts</span>
            {placeholder.hasPlaceholder && (
              <OraclePlaceholderMarker placeholder={placeholder} kind="stats" className="ml-1 text-base" />
            )}
          </span>
          <span className="text-[11px] font-sans text-zinc-400">Sleeper baseline</span>
        </div>

        <div className="px-3 sm:px-4 flex flex-col">
          <span className="text-xs font-sans text-zinc-400">Overall Modifier</span>
          <span
            className={`font-mono text-xl sm:text-2xl font-semibold tabular-nums inline-flex items-baseline gap-1 ${modifierTextColor(
              forecast.overallModifierPts,
            )}`}
          >
            <span>{formatSignedModifier(forecast.overallModifierPts)}</span>
            <span className="text-xs font-normal text-zinc-400">pts</span>
          </span>
          <span className="text-[11px] font-sans text-zinc-400">
            {activePredictorCount === 1 ? '1 predictor' : `${activePredictorCount} predictors`}
          </span>
        </div>

        <div className="pl-3 sm:pl-4 flex flex-col">
          <span className="text-xs font-sans text-amber-200/90">Projected</span>
          <span className="font-mono text-xl sm:text-2xl font-semibold text-amber-200 tabular-nums inline-flex items-baseline gap-1">
            <span>{forecast.adjustedPts.toFixed(1)}</span>
            <span className="text-xs font-normal text-zinc-400">pts</span>
            {placeholder.hasPlaceholder && (
              <OraclePlaceholderMarker placeholder={placeholder} className="ml-1 text-base" />
            )}
          </span>
          <span className="text-[11px] font-sans text-zinc-400">Base + Modifier</span>
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          aria-expanded={isDossierOpen}
          onClick={() => setIsDossierOpen(!isDossierOpen)}
          className="w-full py-2 flex items-center justify-between text-xs font-sans font-medium text-zinc-300 hover:text-zinc-100 transition-colors"
        >
          <span>{isDossierOpen ? 'Hide predictor breakdown' : 'View predictor breakdown'}</span>
          {isDossierOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {isDossierOpen && (
          <div className="mt-2 pt-3 border-t border-white/[0.06] space-y-2 text-xs">
            {topSystems.map((sys) => (
              <div key={sys.systemId} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="font-sans text-zinc-300">{sys.shortName}</span>
                <span className={`font-mono tabular-nums font-medium ${modifierTextColor(sys.jointContributionPts)}`}>
                  {formatSignedModifier(sys.jointContributionPts)} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default RecommendedPickHero;
