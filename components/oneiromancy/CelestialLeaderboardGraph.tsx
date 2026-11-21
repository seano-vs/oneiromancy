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

import React, { useState, useMemo } from 'react';
import UserAvatar from '@/components/common/UserAvatar';
import { CompetitorTeam, CosmicPlayer } from '@/types/oneiromancy';
import { hasUserSuffix, stripUserSuffix } from '@/lib/scoring';
import {
  formatSignedModifier,
  modifierTextColor,
  playerForecast,
  resolveActiveWeek,
} from '@/lib/oracle';
import { useOptionalOneiromancy } from '@/context/OneiromancyContext';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type LeaderboardMetric = 'overall' | 'draft' | 'spirit';

export interface CelestialLeaderboardGraphProps {
  competitorTeams: CompetitorTeam[];
  cosmicBoard?: CosmicPlayer[];
  userSlot?: number;
  selectedRosterId?: number;
  onSelectTeam?: (rosterId: number) => void;
  className?: string;
}

export const CelestialLeaderboardGraph: React.FC<CelestialLeaderboardGraphProps> = ({
  competitorTeams,
  cosmicBoard = [],
  selectedRosterId,
  onSelectTeam,
  className = '',
}) => {
  const ctx = useOptionalOneiromancy();
  const activeWeek = resolveActiveWeek(ctx?.draftState);
  const enabledSystems = ctx?.enabledSystems;
  const [metric, setMetric] = useState<LeaderboardMetric>('overall');
  const [showAllTeams, setShowAllTeams] = useState<boolean>(true);

  const effectiveBoard = useMemo(
    () =>
      cosmicBoard && cosmicBoard.length > 0
        ? cosmicBoard
        : (ctx?.draftState?.cosmic_board ?? []),
    [cosmicBoard, ctx?.draftState?.cosmic_board],
  );

  const byId = useMemo(
    () => new Map(effectiveBoard.map((p) => [String(p.id), p])),
    [effectiveBoard],
  );

  const rankedTeams = useMemo(() => {
    const teamsWithMetrics = competitorTeams.map((team, idx) => {
      const slotNum = team.slot || team.roster_id || idx + 1;
      const isUser = team.is_user === true || hasUserSuffix(team.name);

      const starterIds =
        team.starters && team.starters.length > 0
          ? team.starters
          : (team.picks || []).slice(0, 8).map((pk) => pk.player_id);
      const starters = starterIds
        .map((id) => byId.get(String(id)))
        .filter((p): p is CosmicPlayer => Boolean(p));

      let baseSum = 0;
      let modSum = 0;
      if (starters.length > 0) {
        for (const p of starters) {
          const f = playerForecast(p, {
            currentWeek: activeWeek,
            enabledSystems,
            placeholder: true,
            nextGameLookahead: true,
          });
          baseSum += Number(f.basePts.toFixed(1));
          modSum += f.overallModifierPts;
        }
      } else {
        baseSum = Number(team.avg_draft_score ? team.avg_draft_score * 1.45 : 112.0);
        modSum = 0;
      }

      const baseTotal = Math.round(baseSum * 10) / 10;
      const modTotal = Math.round(modSum * 100) / 100;
      const projTotal = Math.round((baseSum + modSum) * 10) / 10;

      let sortValue = projTotal;
      let mobileDisplay = projTotal.toFixed(1);
      if (metric === 'draft') {
        sortValue = baseTotal;
        mobileDisplay = baseTotal.toFixed(1);
      } else if (metric === 'spirit') {
        sortValue = modTotal;
        mobileDisplay = formatSignedModifier(modTotal);
      }

      const cleanName = stripUserSuffix(team.name, 'Team');
      const recordText =
        typeof team.wins === 'number'
          ? `${team.wins}-${team.losses ?? 0}${team.ties ? `-${team.ties}` : ''}`
          : starters.length > 0
            ? `${starters.length} starters`
            : 'Lineup';

      return {
        team,
        slotNum,
        cleanName,
        recordText,
        isUser,
        baseTotal,
        modTotal,
        projTotal,
        sortValue,
        mobileDisplay,
      };
    });

    return teamsWithMetrics.sort((a, b) => b.sortValue - a.sortValue);
  }, [competitorTeams, byId, activeWeek, enabledSystems, metric]);

  const displayedTeams = showAllTeams ? rankedTeams : rankedTeams.slice(0, 5);

  return (
    <section
      data-testid="celestial-leaderboard"
      aria-label="Team standings"
      className={`rounded-xl border border-white/[0.08] bg-[#16181d] overflow-hidden ${className}`}
    >
      <div className="px-4 py-3 bg-[#121418] border-b border-white/[0.08] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
        <h3 className="font-sans text-sm font-semibold text-zinc-100">
          Standings
        </h3>

        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-sans self-stretch sm:self-auto justify-between sm:justify-start">
          {(
            [
              { id: 'overall', label: 'Projected', testId: 'leaderboard-toggle-projected' },
              { id: 'draft', label: 'Base', testId: 'leaderboard-toggle-base' },
              { id: 'spirit', label: 'Modifier', testId: 'leaderboard-toggle-modifier' },
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              data-testid={btn.testId}
              aria-pressed={metric === btn.id}
              onClick={() => setMetric(btn.id)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                metric === btn.id
                  ? 'bg-zinc-800 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 font-medium'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Column Headers */}
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between gap-2 text-[11px] font-sans font-medium text-zinc-400">
        <div className="flex items-center gap-2.5">
          <span className="w-6 text-right">#</span>
          <span>Team</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-5 shrink-0 text-right">
          <span className={`hidden sm:inline-block w-12 ${metric === 'draft' ? 'text-zinc-200 font-semibold' : ''}`}>Base</span>
          <span className={`hidden sm:inline-block w-14 ${metric === 'spirit' ? 'text-zinc-200 font-semibold' : ''}`}>Modifier</span>
          <span className={`w-16 ${metric === 'overall' ? 'text-zinc-200 font-semibold' : ''}`}>
            <span className="sm:hidden">
              {metric === 'spirit' ? 'Modifier' : metric === 'draft' ? 'Base' : 'Projected'}
            </span>
            <span className="hidden sm:inline">Projected</span>
          </span>
        </div>
      </div>

      <div className="divide-y divide-white/[0.05]">
        {displayedTeams.map((item, index) => {
          const rank = index + 1;
          const isRankOne = rank === 1;
          const isSelected = selectedRosterId === item.team.roster_id;

          return (
            <div
              key={item.slotNum}
              role={onSelectTeam ? 'button' : undefined}
              tabIndex={onSelectTeam ? 0 : undefined}
              aria-pressed={onSelectTeam ? isSelected : undefined}
              onClick={() => onSelectTeam?.(item.team.roster_id)}
              onKeyDown={
                onSelectTeam
                  ? (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectTeam(item.team.roster_id);
                      }
                    }
                  : undefined
              }
              data-testid={
                item.isUser
                  ? 'leaderboard-user-team'
                  : isRankOne
                  ? 'leaderboard-row-rank-1'
                  : `leaderboard-row-slot-${item.slotNum}`
              }
              title={`${item.cleanName} · ${item.projTotal.toFixed(1)} projected pts`}
              className={`px-4 py-2.5 text-xs font-sans transition-colors flex items-center justify-between gap-2 ${
                onSelectTeam ? 'cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-amber-400/70' : ''
              } ${
                item.isUser
                  ? 'bg-amber-500/[0.05] hover:bg-amber-500/[0.08]'
                  : isSelected
                  ? 'bg-white/[0.04] hover:bg-white/[0.06]'
                  : 'hover:bg-white/[0.025]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span
                  data-testid={isRankOne && item.isUser ? 'leaderboard-row-rank-1' : undefined}
                  className={`w-6 text-right font-mono tabular-nums shrink-0 ${
                    isRankOne ? 'text-amber-300 font-semibold' : 'text-zinc-400'
                  }`}
                >
                  {rank}
                </span>
                <UserAvatar
                  src={item.team.avatar_url || item.team.avatar}
                  alt={`${item.cleanName} avatar`}
                  fallbackText={item.cleanName}
                  size="sm"
                  isUser={item.isUser}
                  testId={`leaderboard-avatar-slot-${item.slotNum}`}
                  data-testid={`leaderboard-avatar-slot-${item.slotNum}`}
                />
                <div className="min-w-0 flex flex-col">
                  <span
                    className={`font-sans break-words leading-snug ${
                      item.isUser ? 'text-zinc-100 font-semibold' : 'text-zinc-200 font-medium'
                    }`}
                  >
                    {item.cleanName}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-zinc-400 leading-tight">
                    {item.recordText}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-5 shrink-0 font-mono tabular-nums text-right">
                <span className={`hidden sm:inline-block w-12 ${metric === 'draft' ? 'text-zinc-100 font-semibold' : 'text-zinc-300'}`}>
                  {item.baseTotal.toFixed(1)}
                </span>
                <span className={`hidden sm:inline-block w-14 font-medium ${modifierTextColor(item.modTotal)}`}>
                  {formatSignedModifier(item.modTotal)}
                </span>
                <span className="w-16 text-sm font-semibold text-zinc-100">
                  <span className="sm:hidden">{item.mobileDisplay}</span>
                  <span className={`hidden sm:inline ${metric === 'overall' ? 'text-amber-200' : 'text-zinc-200'}`}>
                    {item.projTotal.toFixed(1)}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {rankedTeams.length > 5 && (
        <div className="px-4 py-2 border-t border-white/[0.06] flex justify-center">
          <button
            type="button"
            aria-expanded={showAllTeams}
            onClick={() => setShowAllTeams((prev) => !prev)}
            className="text-xs font-sans font-medium text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1 transition-colors py-0.5 cursor-pointer"
          >
            <span>{showAllTeams ? 'Show top 5' : `Show all ${rankedTeams.length} teams`}</span>
            {showAllTeams ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </section>
  );
};

export default CelestialLeaderboardGraph;
