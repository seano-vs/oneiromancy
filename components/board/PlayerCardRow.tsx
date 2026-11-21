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

import React from 'react';
import PositionalBadge from '@/components/common/PositionalBadge';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import OraclePlaceholderMarker from '@/components/common/OraclePlaceholderMarker';
import { CosmicPlayer } from '@/types/oneiromancy';
import { isPlayerOnByeWeek, stripUserSuffix } from '@/lib/scoring';
import { getSeasonContext } from '@/lib/sleeper';
import { MAX_COMPARE_PLAYERS, useOptionalOneiromancy } from '@/context/OneiromancyContext';
import {
  formatSignedModifier,
  modifierTextColor,
  oraclePlaceholderInfo,
  playerForecast,
  resolveActiveWeek,
} from '@/lib/oracle';

export interface PlayerCardRowProps {
  player: CosmicPlayer;
  rank: number;
  onInspect: (player: CosmicPlayer) => void;
  onDraft?: (playerId: string) => void;
  isDrafting?: boolean;
  className?: string;
  lambda?: number;
  activeWeek?: number;
  waiverHint?: {
    dropName: string;
    oracleGain: number;
    wouldStart?: boolean;
  };
  tradeHint?: {
    partnerName: string;
    give?: CosmicPlayer;
    giveName?: string;
    gain?: number;
    oracleGain?: number;
  };
  isCompared?: boolean;
  isCompareDisabled?: boolean;
  onToggleCompare?: (id: string) => void;
}

/**
 * Compact player row: single click opens PlayerDetailModal directly.
 * Displays strictly next-game Base projected points and the combined 25-predictor Modifier.
 */
export const PlayerCardRow: React.FC<PlayerCardRowProps> = ({
  player,
  rank,
  onInspect,
  className = '',
  activeWeek: propActiveWeek,
  waiverHint,
  tradeHint,
  isCompared = false,
  isCompareDisabled = false,
  onToggleCompare,
}) => {
  const ctx = useOptionalOneiromancy();
  const isAvailable = player.draft_status === 'available';
  const isMyTeam = player.draft_status === 'my_team';
  const isSevereInjury =
    player.injury_status &&
    ['Out', 'IR', 'NA', 'Doubtful', 'PUP', 'Sus'].includes(player.injury_status);
  const seasonCtx = getSeasonContext();
  const activeWk = resolveActiveWeek(ctx?.draftState, propActiveWeek);
  const onByeNow = isPlayerOnByeWeek(activeWk, player.bye_week, player.team, seasonCtx?.byeWeeks);
  const placeholder = oraclePlaceholderInfo(player, activeWk);
  const forecast = playerForecast(player, {
    currentWeek: activeWk,
    enabledSystems: ctx?.enabledSystems,
    placeholder: true,
    nextGameLookahead: true,
  });
  const basePts = onByeNow ? 0 : forecast.basePts;
  const modPts = forecast.overallModifierPts;

  const tradeGiveName = tradeHint?.give?.name || tradeHint?.giveName;
  const tradePartner = tradeHint ? stripUserSuffix(tradeHint.partnerName) : '';
  const tradeGain = tradeHint ? (tradeHint.gain ?? tradeHint.oracleGain) : undefined;
  const tradeSummary = [
    tradeGiveName ? `Send ${tradeGiveName}` : '',
    tradePartner,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      onClick={() => onInspect(player)}
      data-testid={`player-card-row-${player.id}`}
      className={`relative group px-3 py-2.5 transition-colors cursor-pointer select-none flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
        isCompared
          ? 'bg-amber-500/[0.08]'
          : onByeNow
          ? 'opacity-50 grayscale bg-zinc-950/40'
          : isMyTeam
          ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.07]'
          : 'hover:bg-white/[0.025]'
      } ${className}`}
    >
      <button
        type="button"
        aria-label={`Inspect ${player.name}`}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onInspect(player);
        }}
        className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-amber-400/70"
      />
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {onToggleCompare && (
          <label
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) {
                e.preventDefault();
                if (!isCompareDisabled || isCompared) {
                  onToggleCompare(String(player.id));
                }
              }
            }}
            className="relative z-10 shrink-0 flex items-center justify-center min-w-[24px] min-h-[24px] p-1 -m-1 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={Boolean(isCompared)}
              disabled={isCompareDisabled}
              title={isCompareDisabled ? `Maximum of ${MAX_COMPARE_PLAYERS} players compared` : undefined}
              onChange={() => {}}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (!isCompareDisabled || isCompared) {
                  onToggleCompare(String(player.id));
                }
              }}
              aria-label={`Compare ${player.name}`}
              className={`checkbox-matte ${
                isCompareDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
              }`}
            />
          </label>
        )}
        <span className="relative z-[1] font-mono text-xs text-zinc-400 min-w-[1.25rem] shrink-0 text-right tabular-nums">{rank}</span>
        <PlayerHeadshot player={player} size="row" className="relative z-[1]" />
        <div className="relative z-[1] min-w-0 flex-1 flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="font-sans font-medium text-sm text-zinc-100 break-words">
              {player.name}
            </span>
            {isCompared && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-500/15 text-amber-300 shrink-0"
                aria-label="Pinned comparison"
              >
                Pinned
              </span>
            )}
            {player.injury_status && player.injury_status !== 'Healthy' && (
              <span
                className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                  isSevereInjury
                    ? 'text-rose-300 bg-rose-950/50 border-rose-500/30'
                    : 'text-amber-300 bg-amber-950/50 border-amber-500/30'
                }`}
              >
                {player.injury_status.toUpperCase()}
              </span>
            )}
            {onByeNow && (
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border text-amber-300 bg-amber-950/50 border-amber-500/30 shrink-0">
                {`BYE WK ${player.bye_week || activeWk}`}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono tabular-nums text-[10.5px] sm:text-[11px] tracking-tight text-zinc-400 min-w-0">
            <span className="inline-flex items-center gap-1 sm:gap-1.5 shrink-0">
              <PositionalBadge position={player.position} size="sm" className="shrink-0" depth={player.depth_chart_order} />
              <span>
                <TeamLogo team={player.team} className="mr-1" />
                {player.team} · Bye {player.bye_week || '-'}
              </span>
            </span>
            {isMyTeam && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-sans text-amber-300 font-medium break-words" aria-hidden="true">
                  My Roster
                </span>
              </>
            )}
            {isMyTeam && <span className="sr-only"> (On your roster)</span>}
            {!isAvailable && !isMyTeam && !tradeHint && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-sans text-zinc-400 break-words">
                  {stripUserSuffix(player.drafted_by) || 'Rostered'}
                </span>
              </>
            )}
          </div>
          {waiverHint && (
            <div className="text-[11px] font-sans text-emerald-300 leading-snug break-words">
              {`Drop ${waiverHint.dropName} `}
              <span className="font-mono tabular-nums">(+{waiverHint.oracleGain.toFixed(1)} pts)</span>
            </div>
          )}
          {!isAvailable && !isMyTeam && tradeHint && tradeSummary && (
            <div className="text-[11px] font-sans text-zinc-400 leading-snug break-words">
              {tradeSummary}
              {tradeGain ? (
                <>
                  {' '}
                  <span className="font-mono tabular-nums">(+{tradeGain.toFixed(1)} pts)</span>
                </>
              ) : (
                ''
              )}
            </div>
          )}
        </div>
      </div>

      {/* Canonical Player Metrics: Base, Modifier & Projected */}
      <div className="relative z-[1] shrink-0 self-end sm:self-auto flex items-center gap-3 sm:gap-3.5 text-right font-mono tabular-nums">
        <span
          className="flex flex-col w-8 sm:w-12"
          title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : 'Projected base points'}
        >
          <span className="text-[10px] font-sans text-zinc-400">Base</span>
          <span className="text-xs font-medium text-zinc-200 inline-flex items-center justify-end">
            {basePts.toFixed(1)}
            {placeholder.hasPlaceholder && (
              <span className="relative z-10 inline-flex">
                <OraclePlaceholderMarker placeholder={placeholder} kind="stats" />
              </span>
            )}
          </span>
        </span>
        <span
          className="flex flex-col w-10 sm:w-14"
          title="Combined +/- point differential across active predictors"
        >
          <span className="text-[9.5px] sm:text-[10px] tracking-tight font-sans text-zinc-400">Modifier</span>
          <span className={`text-xs sm:text-sm font-semibold inline-flex items-center justify-end ${modifierTextColor(modPts)}`}>
            {formatSignedModifier(modPts)}
          </span>
        </span>
        <span
          data-testid="row-projected-cell"
          className="flex flex-col w-11 sm:w-14"
          title={`Projected net points (${forecast.basePts.toFixed(1)} base ${formatSignedModifier(modPts)} mod)`}
        >
          <span className="text-[9.5px] sm:text-[10px] tracking-tight font-sans text-amber-200/90">Projected</span>
          <span className="text-xs sm:text-sm font-semibold text-amber-200 inline-flex items-center justify-end">
            {forecast.adjustedPts.toFixed(1)}
            {placeholder.hasPlaceholder && (
              <span className="relative z-10 inline-flex">
                <OraclePlaceholderMarker placeholder={placeholder} />
              </span>
            )}
          </span>
        </span>
      </div>
    </div>
  );
};

export default PlayerCardRow;
