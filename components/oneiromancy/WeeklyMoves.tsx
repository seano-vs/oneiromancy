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

import React, { useMemo, useState } from 'react';
import { useOneiromancy } from '@/context/OneiromancyContext';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import { TeamLogo } from '@/components/common/PlayerHeadshot';
import PlayerLink, { type InspectTarget } from '@/components/common/PlayerLink';
import { stripUserSuffix } from '@/lib/scoring';
import {
  DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS,
  buildUnitMap,
  computeByeOutlook,
  computeLineupCheck,
  computeTradePartners,
  computeWaiverMoves,
  formatSignedModifier,
  resolveActiveWeek,
  type LineupSwap,
} from '@/lib/oracle';

import type { CompetitorTeam, CosmicPlayer, RosterSlot } from '@/types/oneiromancy';

// Stable empty defaults so memo dependencies don't change every render.
const NO_MY_ROSTER: RosterSlot[] = [];
const NO_COSMIC_BOARD: CosmicPlayer[] = [];
const NO_COMPETITOR_TEAMS: CompetitorTeam[] = [];

/** Two bars comparing a pair of values, each scaled safely to positive bar widths. */
export const PairBars: React.FC<{
  label: string;
  a: number;
  b: number;
  format: (n: number) => string;
  tone: 'stats' | 'stars';
}> = ({ label, a, b, format, tone }) => {
  const shift = tone === 'stars' ? 1.5 : 0;
  const posA = Math.max(0.05, a + shift);
  const posB = Math.max(0.05, b + shift);
  const max = Math.max(posA, posB, 0.1);
  const fill = tone === 'stats' ? 'bg-zinc-400' : 'bg-amber-400';
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_6.5rem] items-center gap-2 text-[11px] font-mono text-zinc-400">
      <span>{label}</span>
      <span className="flex flex-col gap-1">
        <span className="h-1.5 rounded bg-zinc-800 overflow-hidden">
          <span className={`block h-full ${fill}`} style={{ width: `${(posA / max) * 100}%` }} />
        </span>
        <span className="h-1.5 rounded bg-zinc-800 overflow-hidden">
          <span className={`block h-full ${fill} opacity-40`} style={{ width: `${(posB / max) * 100}%` }} />
        </span>
      </span>
      <span className="text-right text-zinc-200 tabular-nums">
        {format(a)} / {format(b)}
      </span>
    </div>
  );
};

function lineupVerdict(s: LineupSwap): string {
  const inName = s.playerIn.name;
  return `${inName} gains +${s.pointsGain.toFixed(1)} net pts (Base ${s.baseIn.toFixed(1)} ${formatSignedModifier(s.modifierIn)}).`;
}

const MoveCard: React.FC<{ kind: string; kindClass: string; children: React.ReactNode }> = ({
  kind,
  kindClass,
  children,
}) => (
  <li className="p-4 rounded-xl bg-[#16181d] border border-white/[0.08] flex flex-col gap-2">
    <span className={`text-[10px] font-mono uppercase tracking-widest ${kindClass}`}>{kind}</span>
    {children}
  </li>
);

export const WeeklyMoves: React.FC = () => {
  const { draftState, setTab, enabledSystems } = useOneiromancy();
  const activeSystems = enabledSystems ?? DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS;
  const [inspected, setInspected] = useState<InspectTarget | null>(null);
  const roster = draftState.my_roster ?? NO_MY_ROSTER;
  const board = draftState.cosmic_board ?? NO_COSMIC_BOARD;
  const teams = draftState.competitor_teams ?? NO_COMPETITOR_TEAMS;
  const currentWeek = resolveActiveWeek(draftState);

  const unitByTeam = useMemo(() => buildUnitMap(board, roster), [board, roster]);
  const evalOptions = useMemo(
    () => ({ currentWeek, enabledSystems: activeSystems, unitByTeam }),
    [currentWeek, activeSystems, unitByTeam],
  );

  const swaps = useMemo(
    () => computeLineupCheck(roster, undefined, currentWeek, evalOptions),
    [roster, currentWeek, evalOptions],
  );
  const waiver = useMemo(
    () => computeWaiverMoves(board, roster, undefined, currentWeek, 1, evalOptions)[0],
    [board, roster, currentWeek, evalOptions],
  );
  const bye = useMemo(
    () => (currentWeek ? computeByeOutlook(roster, currentWeek, 3)[0] : undefined),
    [roster, currentWeek],
  );
  const trade = useMemo(
    () => computeTradePartners(teams, board, roster, undefined, evalOptions)[0],
    [teams, board, roster, evalOptions],
  );

  const tabButton = (label: string, tab: string) => (
    <button
      type="button"
      onClick={() => setTab(tab as any)}
      className="px-3 py-1.5 rounded-md border border-white/10 text-xs text-zinc-200 hover:border-white/25"
    >
      {label}
    </button>
  );

  const hasMoves = swaps.length > 0 || waiver || bye || trade;

  return (
    <section aria-labelledby="weekly-moves-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="weekly-moves-heading" className="font-serif text-xl font-bold text-zinc-100">
          Your moves
        </h3>
        <span className="text-[11px] font-mono text-zinc-400">ranked by net pts</span>
      </div>
      {!hasMoves && (
        <p className="p-4 rounded-xl bg-[#16181d] border border-white/[0.08] text-sm text-zinc-300">
          Your starting lineup maximizes projected points and modifiers, and no waiver move beats your bench.
        </p>
      )}
      <ol className="flex flex-col gap-3" data-testid="weekly-moves">
        {swaps.map((s) => (
          <MoveCard key={`swap-${s.playerIn.id}`} kind={`Lineup · ${s.slot}`} kindClass="text-sky-300">
            <span className="text-base font-semibold text-zinc-100">
              Start <PlayerLink player={s.playerIn} vs={s.playerOut ?? null} onOpen={setInspected} />
              {s.playerOut ? (
                <>
                  {' '}over <PlayerLink player={s.playerOut} vs={s.playerIn} onOpen={setInspected} />
                </>
              ) : null}
            </span>
            {s.moved && (
              <span className="text-xs text-zinc-400">
                {s.moved.player.name} moves to {s.moved.to}.
              </span>
            )}
            <PairBars label="Base" a={s.baseIn} b={s.baseOut} format={(n) => n.toFixed(1)} tone="stats" />
            <PairBars label="Mod" a={s.modifierIn} b={s.modifierOut} format={(n) => formatSignedModifier(n)} tone="stars" />
            <span className="text-xs font-mono text-zinc-300">{lineupVerdict(s)}</span>
          </MoveCard>
        ))}

        {waiver && (
          <MoveCard kind={`Waiver · ${waiver.add.position}`} kindClass="text-emerald-300">
            <span className="text-base font-semibold text-zinc-100">
              Add <PlayerLink player={waiver.add} vs={waiver.drop} onOpen={setInspected} /> (
              <TeamLogo team={waiver.add.team} className="mr-1" />
              {waiver.add.team}),
              drop <PlayerLink player={waiver.drop} vs={waiver.add} onOpen={setInspected} />
            </span>
            <span className="text-xs text-zinc-400">{waiver.reason}</span>
            <div className="flex flex-wrap gap-2">
              {tabButton('All waiver moves', 'market')}
            </div>
          </MoveCard>
        )}

        {bye && (
          <MoveCard kind={`Plan ahead · Week ${bye.week}`} kindClass="text-amber-300">
            <span className="text-base font-semibold text-zinc-100">
              {bye.starters.length} starter{bye.starters.length === 1 ? '' : 's'} on bye:{' '}
              {bye.starters.map((p) => `${p.name} (${p.position})`).join(', ')}
            </span>
            <span className="text-xs text-zinc-400">
              {bye.bench.length > 0
                ? `Also off from your bench: ${bye.bench.map((p) => p.name).join(', ')}. `
                : ''}
              Line up cover before week {bye.week}.
            </span>
          </MoveCard>
        )}

        {trade && (
          <MoveCard kind="Trade idea · lineup fit" kindClass="text-violet-300">
            <span className="text-base font-semibold text-zinc-100">
              {trade.give && trade.get ? (
                <>
                  Offer <PlayerLink player={trade.give.player} vs={trade.get.player} onOpen={setInspected} /> to{' '}
                  {stripUserSuffix(trade.team.name, 'Team')} for{' '}
                  <PlayerLink player={trade.get.player} vs={trade.give.player} onOpen={setInspected} />
                </>
              ) : (
                `${stripUserSuffix(trade.team.name, 'Team')} is short at ${trade.youCanOffer.join(' and ')}`
              )}
            </span>
            <span className="text-xs text-zinc-400">
              {trade.give && trade.get
                ? `${trade.give.player.name} would start over their ${trade.give.replaces.name}; ${trade.get.player.name} would start over your ${trade.get.replaces.name}.`
                : trade.summary}
            </span>
            <div className="flex flex-wrap gap-2">{tabButton('See trade partners', 'trades')}</div>
          </MoveCard>
        )}
      </ol>
      <PlayerDetailModal
        player={inspected?.player ?? null}
        compareWith={inspected?.vs ?? null}
        isOpen={inspected !== null}
        onClose={() => setInspected(null)}
        roster={roster}
        activeWeek={currentWeek}
      />
    </section>
  );
};

export default WeeklyMoves;
