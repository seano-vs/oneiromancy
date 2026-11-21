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

import { ChevronDown, ExternalLink, HelpCircle, X } from 'lucide-react';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import OraclePlaceholderMarker from '@/components/common/OraclePlaceholderMarker';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import PositionalBadge from '@/components/common/PositionalBadge';
import { useOptionalOneiromancy } from '@/context/OneiromancyContext';
import {
  GITHUB_EMPIRICAL_STUDY_URL,
  PREDICTOR_CATEGORIES,
  buildUnitMap,
  computePlayerTeamElementalBalance,
  formatSignedModifier,
  modifierTextColor,
  oraclePlaceholderInfo,
  playerForecast,
  resolveActiveWeek,
} from '@/lib/oracle';
import { resolveTeamNextGame } from '@/lib/pointDiffEngine';
import { isPlayerOnByeWeek, stripUserSuffix } from '@/lib/scoring';
import { getSeasonContext, resolveNFLTeamUnit } from '@/lib/sleeper';
import { CosmicPlayer, RosterSlot } from '@/types/oneiromancy';

const RADAR_CX = 115;
const RADAR_CY = 96;
const RADAR_MAX_R = 62;
const RADAR_SPOKE_ANGLES = [-90, -18, 54, 126, 198] as const;

const EMPTY_BOARD: readonly CosmicPlayer[] = [];
const EMPTY_ROSTER: readonly RosterSlot[] = [];

type ModalHistoryEntry = {
  isOpen: boolean;
  playerId: string | null;
  entryId: string | null;
  pushed: boolean;
  awaitingRePush: boolean;
  reusedPendingEntry: boolean;
  adoptedWithoutPush: boolean;
  onClose: () => void;
};

type ModalHistoryStore = {
  sessionId: string;
  nextModalEntrySeq: number;
  pendingBacks: number;
  lastPendingBackFromState: unknown;
  lastPendingBackEntryId: string | null;
  attachedPopStateWindow: Window | null;
  attachedPopStateHandler?: ((event: PopStateEvent) => void) | null;
  registeredModalEntries: Set<ModalHistoryEntry>;
};

declare global {
  interface Window {
    __oneiromancyModalHistory__?: ModalHistoryStore;
  }
}

let ssrModalStore: ModalHistoryStore | null = null;

function getModalHistoryStore(): ModalHistoryStore {
  if (typeof window !== 'undefined') {
    if (!window.__oneiromancyModalHistory__) {
      window.__oneiromancyModalHistory__ = {
        sessionId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        nextModalEntrySeq: 0,
        pendingBacks: 0,
        lastPendingBackFromState: null,
        lastPendingBackEntryId: null,
        attachedPopStateWindow: null,
        attachedPopStateHandler: null,
        registeredModalEntries: new Set<ModalHistoryEntry>(),
      };
    }
    return window.__oneiromancyModalHistory__;
  }
  if (!ssrModalStore) {
    ssrModalStore = {
      sessionId: 'ssr-session',
      nextModalEntrySeq: 0,
      pendingBacks: 0,
      lastPendingBackFromState: null,
      lastPendingBackEntryId: null,
      attachedPopStateWindow: null,
      attachedPopStateHandler: null,
      registeredModalEntries: new Set<ModalHistoryEntry>(),
    };
  }
  return ssrModalStore;
}

function createModalHistoryEntryId(): string {
  const store = getModalHistoryStore();
  store.nextModalEntrySeq += 1;
  return `${store.sessionId}:${store.nextModalEntrySeq}`;
}

function safeCurrentHistoryState(): Record<string, unknown> {
  if (
    typeof window !== 'undefined' &&
    window.history?.state &&
    typeof window.history.state === 'object'
  ) {
    return window.history.state as Record<string, unknown>;
  }
  return {};
}

function syncClearedStalePendingBacks(): void {
  const store = getModalHistoryStore();
  if (store.pendingBacks <= 0 || typeof window === 'undefined' || !window.history) return;
  const currentState = window.history.state ?? null;
  const currentEntryId =
    typeof (currentState as any)?.oneiromancyEntryId === 'string'
      ? (currentState as any).oneiromancyEntryId
      : null;
  if (
    store.lastPendingBackFromState !== null &&
    currentState !== store.lastPendingBackFromState &&
    currentEntryId !== store.lastPendingBackEntryId
  ) {
    store.pendingBacks = 0;
    store.lastPendingBackFromState = null;
    store.lastPendingBackEntryId = null;
  }
}

function triggerModalHistoryBack(expectedEntryId: string | null = null): void {
  if (typeof window === 'undefined' || !window.history) return;
  const store = getModalHistoryStore();
  const currentState = window.history.state ?? null;
  const currentEntryId =
    typeof (currentState as any)?.oneiromancyEntryId === 'string'
      ? (currentState as any).oneiromancyEntryId
      : null;
  if (
    expectedEntryId &&
    currentEntryId !== expectedEntryId
  ) {
    return;
  }
  store.lastPendingBackFromState = currentState;
  store.lastPendingBackEntryId = currentEntryId;
  store.pendingBacks += 1;
  window.history.back?.();
}

function handleGlobalModalPopState(event: PopStateEvent): void {
  const store = getModalHistoryStore();
  if (store.pendingBacks > 0) {
    store.pendingBacks -= 1;
    if (store.pendingBacks === 0) {
      store.lastPendingBackFromState = null;
      store.lastPendingBackEntryId = null;
    }
    for (const entry of store.registeredModalEntries) {
      if (entry.awaitingRePush) {
        entry.awaitingRePush = false;
        entry.reusedPendingEntry = false;
        if (
          entry.isOpen &&
          entry.playerId &&
          canUseBrowserHistory() &&
          window.history.state?.oneiromancyEntryId !== entry.entryId
        ) {
          const entryId = createModalHistoryEntryId();
          entry.entryId = entryId;
          entry.pushed = true;
          window.history.pushState(
            {
              ...safeCurrentHistoryState(),
              oneiromancyModal: 'playerDetail',
              oneiromancyEntryId: entryId,
              playerId: entry.playerId,
            },
            '',
          );
        }
        return;
      }
    }
    return;
  }

  const poppedEntryId = event?.state?.oneiromancyEntryId;
  for (const entry of store.registeredModalEntries) {
    if (entry.pushed && poppedEntryId !== entry.entryId) {
      entry.pushed = false;
      entry.awaitingRePush = false;
      entry.reusedPendingEntry = false;
      entry.adoptedWithoutPush = false;
      entry.entryId = null;
      entry.onClose();
    }
  }
}

function ensureGlobalPopStateListener(): void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  const store = getModalHistoryStore();
  if (
    store.attachedPopStateWindow !== window ||
    store.attachedPopStateHandler !== handleGlobalModalPopState
  ) {
    if (
      store.attachedPopStateWindow &&
      store.attachedPopStateHandler &&
      typeof store.attachedPopStateWindow.removeEventListener === 'function'
    ) {
      store.attachedPopStateWindow.removeEventListener('popstate', store.attachedPopStateHandler);
    }
    window.addEventListener('popstate', handleGlobalModalPopState);
    store.attachedPopStateWindow = window;
    store.attachedPopStateHandler = handleGlobalModalPopState;
  }
}

export function resetPlayerDetailModalHistoryForTest(): void {
  const store = getModalHistoryStore();
  store.pendingBacks = 0;
  store.lastPendingBackFromState = null;
  store.lastPendingBackEntryId = null;
  for (const entry of store.registeredModalEntries) {
    entry.pushed = false;
    entry.awaitingRePush = false;
    entry.reusedPendingEntry = false;
    entry.adoptedWithoutPush = false;
    entry.entryId = null;
  }
  if (
    store.attachedPopStateWindow &&
    typeof store.attachedPopStateWindow.removeEventListener === 'function'
  ) {
    const handler = store.attachedPopStateHandler ?? handleGlobalModalPopState;
    store.attachedPopStateWindow.removeEventListener('popstate', handler);
    store.attachedPopStateWindow = null;
    store.attachedPopStateHandler = null;
  }
  if (store.registeredModalEntries.size > 0) {
    ensureGlobalPopStateListener();
  }
}

function canUseBrowserHistory(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.history?.pushState === 'function'
  );
}

export interface PlayerDetailModalProps {
  player: CosmicPlayer | null;
  isOpen: boolean;
  onClose: () => void;
  onDraft?: (playerId: string) => void;
  roster?: RosterSlot[];
  compareWith?: CosmicPlayer | null;
  compareCandidates?: CosmicPlayer[] | null;
  activeWeek?: number;
  transitNote?: { venue?: string; sky?: string; rationale?: string } | null;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  player,
  isOpen,
  onClose,
  roster: propRoster,
  compareWith = null,
  compareCandidates = null,
  activeWeek: propActiveWeek,
  transitNote = null,
}) => {
  const rawContentId = useId();
  const contentId = `roster-role-comp-content-${rawContentId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [isRoleCompOpen, setIsRoleCompOpen] = useState(true);
  const [activePredictorInfoId, setActivePredictorInfoId] = useState<string | null>(null);
  const ctx = useOptionalOneiromancy();
  const [showRoster, setShowRoster] = useState(false);
  const comparisonKey = `${player?.id ?? ''}|${compareWith?.id ?? ''}|${(compareCandidates ?? []).map((c) => c.id).join(',')}`;
  useEffect(() => {
    setShowRoster(false);
    setIsRoleCompOpen(true);
    setActivePredictorInfoId(null);
  }, [comparisonKey, isOpen]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const activePlayerId =
    player?.id !== undefined && player?.id !== null && player.id !== ''
      ? String(player.id)
      : null;
  const modalEntryRef = useRef<ModalHistoryEntry | null>(null);
  if (!modalEntryRef.current) {
    modalEntryRef.current = {
      isOpen,
      playerId: activePlayerId,
      entryId: null,
      pushed: false,
      awaitingRePush: false,
      reusedPendingEntry: false,
      adoptedWithoutPush: false,
      onClose: () => onCloseRef.current(),
    };
  }
  modalEntryRef.current.isOpen = isOpen;
  modalEntryRef.current.playerId = isOpen ? activePlayerId : null;
  modalEntryRef.current.onClose = () => onCloseRef.current();

  const requestClose = useCallback(() => {
    syncClearedStalePendingBacks();
    const entry = modalEntryRef.current!;
    if (entry.pushed && canUseBrowserHistory()) {
      const closingEntryId = entry.entryId;
      entry.pushed = false;
      entry.entryId = null;
      if (entry.reusedPendingEntry) {
        entry.reusedPendingEntry = false;
        entry.awaitingRePush = false;
        entry.adoptedWithoutPush = false;
        onCloseRef.current();
        return;
      }
      if (entry.adoptedWithoutPush) {
        entry.adoptedWithoutPush = false;
        entry.awaitingRePush = false;
        const cur = safeCurrentHistoryState();
        if (cur && typeof cur === 'object') {
          const { oneiromancyModal: _m, oneiromancyEntryId: _e, playerId: _p, ...rest } = cur;
          window.history.replaceState?.(rest, '');
        }
        onCloseRef.current();
        return;
      }
      entry.awaitingRePush = false;
      entry.adoptedWithoutPush = false;
      triggerModalHistoryBack(closingEntryId);
    }
    onCloseRef.current();
  }, []);

  useEffect(() => {
    const store = getModalHistoryStore();
    const entry = modalEntryRef.current!;
    store.registeredModalEntries.add(entry);
    ensureGlobalPopStateListener();
    return () => {
      store.registeredModalEntries.delete(entry);
      if (
        store.registeredModalEntries.size === 0 &&
        store.attachedPopStateWindow &&
        typeof store.attachedPopStateWindow.removeEventListener === 'function'
      ) {
        const handler = store.attachedPopStateHandler ?? handleGlobalModalPopState;
        store.attachedPopStateWindow.removeEventListener('popstate', handler);
        store.attachedPopStateWindow = null;
        store.attachedPopStateHandler = null;
      }
    };
  }, []);

  // All callers render <PlayerDetailModal isOpen={...} /> persistently so the
  // !isOpen branch handles popping the modal history entry when dismissed externally.
  useEffect(() => {
    if (!canUseBrowserHistory()) return;
    syncClearedStalePendingBacks();
    ensureGlobalPopStateListener();
    const store = getModalHistoryStore();
    const entry = modalEntryRef.current!;
    if (isOpen && activePlayerId) {
      if (!entry.pushed) {
        entry.pushed = true;
        if (window.history.state?.oneiromancyModal === 'playerDetail') {
          const entryId = createModalHistoryEntryId();
          entry.entryId = entryId;
          entry.awaitingRePush = store.pendingBacks > 0;
          entry.reusedPendingEntry = store.pendingBacks > 0;
          entry.adoptedWithoutPush = store.pendingBacks === 0;
          const nextState = {
            ...safeCurrentHistoryState(),
            oneiromancyModal: 'playerDetail',
            oneiromancyEntryId: entryId,
            playerId: activePlayerId,
          };
          window.history.replaceState?.(nextState, '');
          if (store.pendingBacks > 0) {
            store.lastPendingBackFromState = window.history.state ?? nextState;
            store.lastPendingBackEntryId = entryId;
          }
        } else {
          if (store.pendingBacks > 0) {
            entry.awaitingRePush = true;
          }
          const entryId = createModalHistoryEntryId();
          entry.entryId = entryId;
          entry.reusedPendingEntry = false;
          entry.adoptedWithoutPush = false;
          window.history.pushState(
            {
              ...safeCurrentHistoryState(),
              oneiromancyModal: 'playerDetail',
              oneiromancyEntryId: entryId,
              playerId: activePlayerId,
            },
            '',
          );
        }
      } else if (
        window.history.state?.oneiromancyModal === 'playerDetail' &&
        window.history.state?.playerId !== activePlayerId
      ) {
        const entryId = createModalHistoryEntryId();
        entry.entryId = entryId;
        const nextState = {
          ...safeCurrentHistoryState(),
          oneiromancyModal: 'playerDetail',
          oneiromancyEntryId: entryId,
          playerId: activePlayerId,
        };
        window.history.replaceState?.(nextState, '');
        if (store.pendingBacks > 0) {
          store.lastPendingBackFromState = window.history.state ?? nextState;
          store.lastPendingBackEntryId = entryId;
        }
      }
      return;
    }

    if (!isOpen && entry.pushed) {
      const closingEntryId = entry.entryId;
      entry.pushed = false;
      entry.entryId = null;
      if (entry.reusedPendingEntry) {
        entry.reusedPendingEntry = false;
        entry.awaitingRePush = false;
        entry.adoptedWithoutPush = false;
        return;
      }
      if (entry.adoptedWithoutPush) {
        entry.adoptedWithoutPush = false;
        entry.awaitingRePush = false;
        const cur = safeCurrentHistoryState();
        if (cur && typeof cur === 'object') {
          const { oneiromancyModal, oneiromancyEntryId, playerId, ...rest } = cur;
          window.history.replaceState?.(rest, '');
        }
        return;
      }
      entry.awaitingRePush = false;
      entry.adoptedWithoutPush = false;
      triggerModalHistoryBack(closingEntryId);
    }
  }, [isOpen, activePlayerId]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener?.('keydown', onKeyDown);
  }, [isOpen, requestClose]);

  const activeRoster = propRoster ?? ctx?.draftState?.my_roster ?? EMPTY_ROSTER;
  const boardPool = ctx?.draftState?.cosmic_board ?? EMPTY_BOARD;
  const seasonCtx = getSeasonContext();
  const activeWk = resolveActiveWeek(ctx?.draftState, propActiveWeek);
  const seasonYear = Number(seasonCtx?.season) || 2025;

  const unitByTeam = useMemo(
    () => (isOpen && boardPool.length > 0 ? buildUnitMap(boardPool, activeRoster) : undefined),
    [isOpen, boardPool, activeRoster],
  );

  const fallbackTeamUnits = useMemo(() => {
    if (!isOpen || !player || boardPool.length > 0) {
      return { teamUnit: undefined, opponentUnit: undefined };
    }
    const teamUnit = resolveNFLTeamUnit(player.team, boardPool, activeRoster, player);
    const nextGameInfo = resolveTeamNextGame(player.team, activeWk, seasonYear);
    const opponentUnit = nextGameInfo?.opponent
      ? resolveNFLTeamUnit(nextGameInfo.opponent, boardPool, activeRoster)
      : [];
    return { teamUnit, opponentUnit };
  }, [isOpen, player, boardPool, activeRoster, activeWk, seasonYear]);

  const elementalTeamUnit = useMemo(() => {
    if (!isOpen || !player) return EMPTY_BOARD;
    if (fallbackTeamUnits.teamUnit) return fallbackTeamUnits.teamUnit;
    const fromMap = unitByTeam?.get(String(player.team || '').trim().toUpperCase());
    if (fromMap && fromMap.length >= 4) return fromMap;
    return resolveNFLTeamUnit(player.team, boardPool, activeRoster, player);
  }, [isOpen, player, fallbackTeamUnits.teamUnit, unitByTeam, boardPool, activeRoster]);

  if (!isOpen || !player) return null;

  const boardRostered: CosmicPlayer[] = boardPool.filter(
    (p) => p.draft_status === 'my_team',
  );

  const isStarterSlot = (slotId: string) =>
    !slotId.startsWith('BN') && slotId !== 'IR' && slotId !== 'TAXI';

  const getPlayerRosterInfo = (p: CosmicPlayer) => {
    const slot = activeRoster.find((s) => s.player && String(s.player.id) === String(p.id));
    if (slot) {
      const isStarter = isStarterSlot(slot.slot_id);
      return {
        isMine: true,
        isStarter,
        slotId: slot.slot_id,
      };
    }
    const isUserOwned =
      p.draft_status === 'my_team' ||
      boardRostered.some((bp) => String(bp.id) === String(p.id));
    return {
      isMine: isUserOwned,
      isStarter: false,
      slotId: '',
    };
  };

  const getPlayerRoleLabel = (p: CosmicPlayer, isUserMine: boolean, defaultLabel: string) => {
    if (isUserMine) return 'Roster';
    if (p.draft_status === 'available') return 'Free Agent';
    if (p.draft_status === 'drafted' || p.drafted_by) {
      const ownerLabel = stripUserSuffix(p.drafted_by);
      return ownerLabel ? `Rostered (${ownerLabel})` : 'Rostered';
    }
    return defaultLabel;
  };

  const getIntraRosterSlotLabel = (
    info: ReturnType<typeof getPlayerRosterInfo>,
    defaultLabel: string
  ) => {
    if (info.isStarter) {
      return info.slotId ? `Starter (${info.slotId})` : 'Starter';
    }
    if (info.slotId) {
      return 'Bench';
    }
    return defaultLabel;
  };

  const sameRoleTeamPlayers: Array<{
    slotLabel: string;
    isStarter: boolean;
    rosterPlayer: CosmicPlayer;
  }> = [];
  const seenIds = new Set<string>();

  for (const slot of activeRoster) {
    if (slot.player && slot.player.position === player.position) {
      const isStarter = isStarterSlot(slot.slot_id);
      sameRoleTeamPlayers.push({
        slotLabel: isStarter ? `STARTER • ${slot.slot_id}` : `BENCH • ${slot.slot_id}`,
        isStarter,
        rosterPlayer: slot.player,
      });
      seenIds.add(String(slot.player.id));
    }
  }
  const inspectedRosterInfo = getPlayerRosterInfo(player);
  const isMine = inspectedRosterInfo.isMine;
  const hasPopulatedRosterSlots = activeRoster.some((s) => Boolean(s.player));
  if (!hasPopulatedRosterSlots) {
    for (const bp of boardRostered) {
      if (bp.position === player.position && !seenIds.has(String(bp.id))) {
        sameRoleTeamPlayers.push({
          slotLabel: 'ROSTER',
          isStarter: false,
          rosterPlayer: bp,
        });
        seenIds.add(String(bp.id));
      }
    }
  }

  const teammates = sameRoleTeamPlayers.filter((r) => String(r.rosterPlayer.id) !== String(player.id));
  const isMultiCompare = Boolean(compareCandidates && compareCandidates.length >= 3);
  const headToHead = Boolean(compareWith) && !showRoster && !isMultiCompare;
  const comparisonRows = headToHead
    ? [
        {
          slotLabel: 'VS',
          isStarter: false,
          rosterPlayer: compareWith as CosmicPlayer,
        },
      ]
    : teammates;

  const forecast = playerForecast(player, {
    currentWeek: activeWk,
    enabledSystems: ctx?.enabledSystems,
    unitByTeam,
    teamUnit: fallbackTeamUnits.teamUnit,
    opponentUnit: fallbackTeamUnits.opponentUnit,
    placeholder: true,
    nextGameLookahead: true,
  });

  const getPlayerDisplayMetrics = (p: CosmicPlayer) => {
    const pOnBye = isPlayerOnByeWeek(activeWk, p.bye_week, p.team, seasonCtx?.byeWeeks);
    const placeholder = oraclePlaceholderInfo(p, activeWk);
    const pf =
      String(p.id) === String(player.id)
        ? forecast
        : playerForecast(p, {
            currentWeek: activeWk,
            enabledSystems: ctx?.enabledSystems,
            unitByTeam,
            placeholder: true,
            nextGameLookahead: true,
          });
    return {
      onBye: pOnBye,
      placeholder,
      base: pf.basePts,
      modifier: pf.overallModifierPts,
      net: pf.adjustedPts,
    };
  };

  let bestCandidateId: string | null = null;
  if (compareCandidates && compareCandidates.length >= 3) {
    let maxNet = -Infinity;
    for (const cand of compareCandidates) {
      const n = getPlayerDisplayMetrics(cand).net;
      if (n > maxNet) {
        maxNet = n;
        bestCandidateId = String(cand.id);
      }
    }
  }

  const candidateMetrics = getPlayerDisplayMetrics(player);
  const enabledSystems = [...forecast.systems]
    .filter((s) => s.enabled)
    .sort((a, b) => {
      const diff = Math.abs(b.jointContributionPts) - Math.abs(a.jointContributionPts);
      if (Math.abs(diff) > 0.0001) return diff;
      return b.activeConditionCount - a.activeConditionCount;
    });
  const enabledPredictorCount = enabledSystems.length;

  const teamBalance = computePlayerTeamElementalBalance(player, elementalTeamUnit);
  const activeTrineElements = (['Fire', 'Earth', 'Air', 'Water'] as const).filter(
    (el) => teamBalance.elementalDistribution[el] >= 3 || teamBalance.arcanaDistribution[el] >= 3,
  );
  const zodiacPolygon = projectRadarPolygon({
    norms: teamBalance.fourElementRadarNorms.zodiac,
  });
  const arcanaPolygon = projectRadarPolygon({
    norms: teamBalance.fourElementRadarNorms.arcana,
  });
  const baziPolygon = projectRadarPolygon({
    norms: teamBalance.fivePhaseRadarNorms.bazi,
  });
  const loShuPolygon = projectRadarPolygon({
    norms: teamBalance.fivePhaseRadarNorms.loShu,
  });

  const isAvailable = player.draft_status === 'available';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-detail-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs"
      onClick={requestClose}
    >
      <div
        onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-t-xl sm:rounded-xl bg-[#16181d] border border-white/10 shadow-2xl overflow-hidden font-sans"
      >
        {/* Modal Top Header */}
        <div className="sticky top-0 z-10 flex-shrink-0 bg-[#16181d] border-b border-white/[0.08] px-5 sm:px-6 py-4 flex justify-between items-start gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <PlayerHeadshot key={String(player.id)} player={player} size="lg" />
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="player-detail-modal-title"
                  className="font-sans text-xl sm:text-2xl font-semibold tracking-tight text-zinc-100"
                >
                  {player.name}
                </h2>
                {isMultiCompare && (
                  <span className="text-xs font-sans font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-white/10">
                    Comparing {compareCandidates!.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
                <PositionalBadge position={player.position} size="sm" depth={player.depth_chart_order} />
                <span className="font-mono tabular-nums text-zinc-300">
                  <TeamLogo team={player.team} className="mr-1" />
                  {player.team} · Bye {player.bye_week || '-'} · #{player.jersey_number}
                </span>
                <span>·</span>
                <span className={isMine ? 'text-amber-300 font-medium' : isAvailable ? 'text-emerald-300' : 'text-zinc-300'}>
                  {isMine
                    ? 'MY ROSTER'
                    : isAvailable
                      ? 'FREE AGENT'
                      : player.drafted_by
                        ? `ROSTERED (${stripUserSuffix(player.drafted_by)})`
                        : 'ROSTERED'}
                </span>
                {player.injury_status && player.injury_status !== 'Healthy' && (
                  <span
                    className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${
                      player.injury_status === 'Out' || player.injury_status === 'IR'
                        ? 'text-rose-300 bg-rose-950/50 border-rose-500/30'
                        : 'text-amber-300 bg-amber-950/50 border-amber-500/30'
                    }`}
                  >
                    {player.injury_status.toUpperCase()}
                  </span>
                )}
                {candidateMetrics.onBye && (
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border text-amber-300 bg-amber-950/50 border-amber-500/30">
                    {`BYE WK ${player.bye_week || activeWk}`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close dossier"
            className="p-2 min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-5 [scrollbar-width:thin]">
          {/* Base, Overall Modifier & Projected */}
          <div
            data-testid="modal-hero-metrics"
            className="grid grid-cols-3 divide-x divide-white/[0.08] border-b border-white/[0.08] pb-4"
          >
            <div
              className="pr-3 sm:pr-4"
              title={
                candidateMetrics.placeholder.hasPlaceholder
                  ? candidateMetrics.placeholder.statsTooltipText
                  : undefined
              }
            >
              <span className="text-xs font-sans text-zinc-400 block">Base</span>
              <span className="text-xl sm:text-2xl font-mono font-semibold text-zinc-100 tabular-nums mt-0.5 inline-flex items-baseline gap-1">
                <span>{(candidateMetrics.onBye ? 0 : forecast.basePts).toFixed(1)}</span>{' '}
                <span className="text-xs font-normal text-zinc-400">pts</span>
              </span>
              <span className="text-[11px] font-sans text-zinc-400 block mt-0.5">
                {candidateMetrics.onBye ? (
                  `Bye Wk ${activeWk} · Next Wk ${forecast.matchup.week}${
                    forecast.basePts > 0 ? ` (${forecast.basePts.toFixed(1)} avg)` : ''
                  }`
                ) : (
                  <>
                    {`Week ${forecast.matchup.week}`}
                    {forecast.matchup.opponent ? (
                      <>
                        {` ${forecast.matchup.isHome ? 'vs' : '@'} `}
                        <TeamLogo
                          team={forecast.matchup.opponent}
                          className="w-3.5 h-3.5 mr-1 align-[-2px]"
                        />
                        {forecast.matchup.opponent}
                      </>
                    ) : (
                      ''
                    )}
                  </>
                )}
              </span>
            </div>

            <div className="px-3 sm:px-4">
              <span className="text-xs font-sans text-zinc-400 block">Overall Modifier</span>
              <span
                className={`text-xl sm:text-2xl font-mono font-semibold tabular-nums mt-0.5 inline-flex items-baseline gap-1 ${modifierTextColor(
                  forecast.overallModifierPts,
                )}`}
              >
                <span>{formatSignedModifier(forecast.overallModifierPts)}</span>{' '}
                <span className="text-xs font-normal text-zinc-400">pts</span>
              </span>
              <span className="text-[11px] font-sans text-zinc-400 block mt-0.5">
                {enabledPredictorCount} of {forecast.systems.length} predictors
              </span>
            </div>

            <div className="pl-3 sm:pl-4" data-testid="modal-hero-projected">
              <span className="text-xs font-sans text-amber-200/90 block">Projected</span>
              <span className="text-xl sm:text-2xl font-mono font-semibold text-amber-200 tabular-nums mt-0.5 inline-flex items-baseline gap-1">
                <span>{forecast.adjustedPts.toFixed(1)}</span>{' '}
                <span className="text-xs font-normal text-zinc-400">pts</span>
                {candidateMetrics.placeholder.hasPlaceholder && (
                  <OraclePlaceholderMarker placeholder={candidateMetrics.placeholder} />
                )}
              </span>
              <span className="text-[11px] font-sans text-zinc-400 block mt-0.5">
                Base + Modifier
              </span>
            </div>
          </div>

          {transitNote && (transitNote.venue || transitNote.sky || transitNote.rationale) && (
            <div
              data-testid="modal-matchup-transit-note"
              className="border-b border-white/[0.08] pb-4 space-y-1 text-xs font-sans"
            >
              <span className="text-[11px] font-medium text-zinc-400 block">
                Matchup Venue &amp; Transit
              </span>
              {(transitNote.venue || transitNote.sky) && (
                <p className="text-zinc-200 font-mono text-[11px] tabular-nums">
                  {[transitNote.venue, transitNote.sky].filter(Boolean).join(' · ')}
                </p>
              )}
              {transitNote.rationale && (
                <p className="text-zinc-300 leading-relaxed">{transitNote.rationale}</p>
              )}
            </div>
          )}

          {/* Player & Real NFL Team Multi-Predictor Elemental Balance */}
          <section
            data-testid="player-team-elemental-balance"
            aria-label="Player and NFL team elemental balance"
            className="border-b border-white/[0.08] pb-4 space-y-3.5 text-xs"
          >
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="font-sans text-xs font-semibold text-zinc-200">
                  Elemental Balance
                </h3>
                <span className="font-mono tabular-nums text-[11px] text-zinc-400">
                  {teamBalance.isFreeAgent ? (
                    'Free agent · 5 traditions'
                  ) : (
                    <>
                      <TeamLogo
                        team={teamBalance.teamCode}
                        className="w-3.5 h-3.5 mr-1 align-[-2px]"
                      />
                      {`${teamBalance.teamCode} NFL unit (${teamBalance.unitPlayers.length}) · 5 traditions`}
                    </>
                  )}
                </span>
              </div>
              <span className="font-mono tabular-nums text-[11px] text-zinc-300">
                Dominant: {teamBalance.dominantCombinedFourElement || teamBalance.dominantElement || '-'} (Zodiac)
                {(teamBalance.dominantCombinedFivePhase || teamBalance.dominantWuXing)
                  ? ` · ${teamBalance.dominantCombinedFivePhase || teamBalance.dominantWuXing} (Five Phases)`
                  : ''}
                {teamBalance.dominantMayanDirection
                  ? ` · ${teamBalance.dominantMayanDirection} (Mayan)`
                  : ''}
              </span>
            </div>

            {/* Clicked Player's Own Elements Across All 5 Predictors */}
            <div
              data-testid="player-multi-predictor-elements"
              className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 py-2.5 border-y border-white/[0.06]"
            >
              <div>
                <div className="text-[10px] font-sans text-zinc-400">Western Zodiac</div>
                <div className="font-mono text-xs font-semibold text-amber-200 mt-0.5">
                  {teamBalance.playerProfile.zodiacElement || '-'}
                </div>
                <div className="text-[10px] font-sans text-zinc-400 break-words leading-snug">
                  {teamBalance.playerProfile.zodiacSign || 'Unlisted'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-sans text-zinc-400">Major Arcana</div>
                <div className="font-mono text-xs font-semibold text-sky-200 mt-0.5">
                  {teamBalance.playerProfile.arcanaElement || '-'}
                </div>
                <div className="text-[10px] font-sans text-zinc-400 break-words leading-snug">
                  {teamBalance.playerProfile.arcanaCard || 'Unlisted'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-sans text-zinc-400">BaZi Wu Xing</div>
                <div className="font-mono text-xs font-semibold text-emerald-200 mt-0.5">
                  {teamBalance.playerProfile.wuXingPhase || '-'}
                </div>
                <div className="text-[10px] font-sans text-zinc-400 break-words leading-snug">
                  {teamBalance.playerProfile.dayStem || 'Unlisted'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-sans text-zinc-400">Lo Shu Ba Gua</div>
                <div className="font-mono text-xs font-semibold text-cyan-200 mt-0.5">
                  {teamBalance.playerProfile.loShuPhase || '-'}
                </div>
                <div className="text-[10px] font-sans text-zinc-400 break-words leading-snug">
                  {teamBalance.playerProfile.loShuStar
                    ? `Star ${teamBalance.playerProfile.loShuStar} · ${
                        teamBalance.playerProfile.loShuGroup === 'EAST' ? 'East group' : 'West group'
                      }`
                    : 'Unlisted'}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[10px] font-sans text-zinc-400">Mayan Tzolk&apos;in</div>
                <div className="font-mono text-xs font-semibold text-zinc-100 mt-0.5">
                  {teamBalance.playerProfile.mayanDirection
                    ? `${teamBalance.playerProfile.mayanDirection} · ${teamBalance.playerProfile.mayanColor}`
                    : '-'}
                </div>
                <div className="text-[10px] font-sans text-zinc-400 break-words leading-snug">
                  {teamBalance.playerProfile.mayanNahual || 'Unlisted'}
                </div>
              </div>
            </div>

            {/* Dual 5-Spoke Radar Graphs: Classical Elements (Zodiac + Arcana) & Five Phases (BaZi + Lo Shu) */}
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              {/* Left Radar: Western Zodiac + Major Arcana */}
              <div className="flex-1 min-w-0 rounded-lg border border-white/[0.06] bg-[#101216] p-3 flex flex-col justify-between gap-2">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="font-sans text-[11px] font-medium text-zinc-200">
                    Classical Elements
                  </span>
                  {activeTrineElements.length > 0 ? (
                    <span className="font-mono text-[10px] text-amber-200 font-medium">
                      {activeTrineElements.join(', ')} · Trine
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-zinc-400">
                      Zodiac / Arcana
                    </span>
                  )}
                </div>

                <svg
                  viewBox="-35 8 280 176"
                  className="w-full max-w-[236px] h-auto mx-auto overflow-visible"
                  data-testid="synergy-constellation-svg"
                  role="img"
                  aria-label={`${teamBalance.teamCode} classical elemental balance chart`}
                >
                  {[0.33, 0.66, 1.0].map((level, idx) => (
                    <circle
                      key={`grid-${idx}`}
                      cx={RADAR_CX}
                      cy={RADAR_CY}
                      r={RADAR_MAX_R * level}
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                    />
                  ))}
                  {RADAR_SPOKE_ANGLES.map((deg, idx) => {
                    const rad = (deg * Math.PI) / 180;
                    return (
                      <line
                        key={`spoke-4el-${idx}`}
                        x1={RADAR_CX}
                        y1={RADAR_CY}
                        x2={RADAR_CX + RADAR_MAX_R * Math.cos(rad)}
                        y2={RADAR_CY + RADAR_MAX_R * Math.sin(rad)}
                        stroke="rgba(255,255,255,0.06)"
                      />
                    );
                  })}
                  <polygon
                    points={arcanaPolygon.polygonString}
                    fill="rgba(56, 189, 248, 0.12)"
                    stroke="#38bdf8"
                    strokeWidth="1.25"
                    strokeDasharray="3 2"
                  />
                  <polygon
                    points={zodiacPolygon.polygonString}
                    fill="rgba(226, 185, 100, 0.16)"
                    stroke="#e2b964"
                    strokeWidth="1.5"
                  />
                  {arcanaPolygon.pts.map((pt, i) => (
                    <circle
                      key={`arcana-vertex-${i}`}
                      cx={pt.x}
                      cy={pt.y}
                      r="1.8"
                      fill="#38bdf8"
                    />
                  ))}
                  {zodiacPolygon.pts.map((pt, i) => (
                    <circle
                      key={`vertex-${i}`}
                      cx={pt.x}
                      cy={pt.y}
                      r="2.2"
                      fill="#e2b964"
                    />
                  ))}
                  <text x="115" y="22" textAnchor="middle" fill="#d4d4d8" fontSize="10" fontFamily="monospace">
                    Fire ({teamBalance.elementalDistribution.Fire}/{teamBalance.arcanaDistribution.Fire})
                  </text>
                  <text x="182" y="76" textAnchor="start" fill="#d4d4d8" fontSize="10" fontFamily="monospace">
                    Air ({teamBalance.elementalDistribution.Air}/{teamBalance.arcanaDistribution.Air})
                  </text>
                  <text x="165" y="170" textAnchor="middle" fill="#d4d4d8" fontSize="10" fontFamily="monospace">
                    Water ({teamBalance.elementalDistribution.Water}/{teamBalance.arcanaDistribution.Water})
                  </text>
                  <text x="65" y="170" textAnchor="middle" fill="#d4d4d8" fontSize="10" fontFamily="monospace">
                    Earth ({teamBalance.elementalDistribution.Earth}/{teamBalance.arcanaDistribution.Earth})
                  </text>
                  <text x="48" y="76" textAnchor="end" fill="#d4d4d8" fontSize="10" fontFamily="monospace">
                    Stacks ({teamBalance.activeStacks.length})
                  </text>
                </svg>

                <div
                  data-testid="four-element-legend"
                  className="flex items-center justify-center gap-3.5 text-[10px] font-mono text-zinc-300 pt-0.5"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-0.5 bg-amber-300" aria-hidden="true" />
                    Western Zodiac
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-0.5 border-t border-dashed border-sky-400" aria-hidden="true" />
                    Major Arcana
                  </span>
                </div>
              </div>

              {/* Right Radar: BaZi Stem + Qi Men Lo Shu Ba Gua */}
              <div
                data-testid="unit-five-phases-strip"
                className="flex-1 min-w-0 rounded-lg border border-white/[0.06] bg-[#101216] p-3 flex flex-col justify-between gap-2"
              >
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="font-sans text-[11px] font-medium text-zinc-200">
                    Five Phases
                  </span>
                  <span className="font-mono tabular-nums text-[10px] text-zinc-400">
                    East {teamBalance.loShuGroupCounts.EAST} · West {teamBalance.loShuGroupCounts.WEST}
                  </span>
                </div>

                <svg
                  viewBox="-35 8 280 176"
                  className="w-full max-w-[236px] h-auto mx-auto overflow-visible"
                  data-testid="five-phase-radar-svg"
                  role="img"
                  aria-label={`${teamBalance.teamCode} five phases radar chart`}
                >
                  {[0.33, 0.66, 1.0].map((level, idx) => (
                    <circle
                      key={`phase-grid-${idx}`}
                      cx={RADAR_CX}
                      cy={RADAR_CY}
                      r={RADAR_MAX_R * level}
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                    />
                  ))}
                  {RADAR_SPOKE_ANGLES.map((deg, idx) => {
                    const rad = (deg * Math.PI) / 180;
                    return (
                      <line
                        key={`spoke-5ph-${idx}`}
                        x1={RADAR_CX}
                        y1={RADAR_CY}
                        x2={RADAR_CX + RADAR_MAX_R * Math.cos(rad)}
                        y2={RADAR_CY + RADAR_MAX_R * Math.sin(rad)}
                        stroke="rgba(255,255,255,0.06)"
                      />
                    );
                  })}
                  <polygon
                    points={loShuPolygon.polygonString}
                    fill="rgba(34, 211, 238, 0.12)"
                    stroke="#22d3ee"
                    strokeWidth="1.25"
                    strokeDasharray="3 2"
                  />
                  <polygon
                    points={baziPolygon.polygonString}
                    fill="rgba(52, 211, 153, 0.15)"
                    stroke="#34d399"
                    strokeWidth="1.5"
                  />
                  {loShuPolygon.pts.map((pt, i) => (
                    <circle
                      key={`loshu-vertex-${i}`}
                      cx={pt.x}
                      cy={pt.y}
                      r="1.8"
                      fill="#22d3ee"
                    />
                  ))}
                  {baziPolygon.pts.map((pt, i) => (
                    <circle
                      key={`bazi-vertex-${i}`}
                      cx={pt.x}
                      cy={pt.y}
                      r="2.2"
                      fill="#34d399"
                    />
                  ))}
                  <text x="115" y="22" textAnchor="middle" fill="#d4d4d8" fontSize="10" fontFamily="monospace">
                    Wood ({teamBalance.wuXingDistribution.Wood}/{teamBalance.loShuPhaseDistribution.Wood})
                  </text>
                  <text x="182" y="76" textAnchor="start" fill="#d4d4d8" fontSize="10" fontFamily="monospace">
                    Fire ({teamBalance.wuXingDistribution.Fire}/{teamBalance.loShuPhaseDistribution.Fire})
                  </text>
                  <text x="165" y="170" textAnchor="middle" fill="#d4d4d8" fontSize="10" fontFamily="monospace">
                    Earth ({teamBalance.wuXingDistribution.Earth}/{teamBalance.loShuPhaseDistribution.Earth})
                  </text>
                  <text x="65" y="170" textAnchor="middle" fill="#d4d4d8" fontSize="10" fontFamily="monospace">
                    Metal ({teamBalance.wuXingDistribution.Metal}/{teamBalance.loShuPhaseDistribution.Metal})
                  </text>
                  <text x="48" y="76" textAnchor="end" fill="#d4d4d8" fontSize="10" fontFamily="monospace">
                    Water ({teamBalance.wuXingDistribution.Water}/{teamBalance.loShuPhaseDistribution.Water})
                  </text>
                </svg>

                <div
                  data-testid="five-phase-legend"
                  className="flex items-center justify-center gap-3.5 text-[10px] font-mono text-zinc-300 pt-0.5"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-0.5 bg-emerald-400" aria-hidden="true" />
                    BaZi Stem
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-0.5 border-t border-dashed border-cyan-400" aria-hidden="true" />
                    Lo Shu Ba Gua
                  </span>
                </div>
              </div>
            </div>

            {/* Mayan Tzolk'in World-Directions + Real NFL Stacks & Multi-Elemental Unit Peers */}
            <div
              data-testid="unit-mayan-directions-strip"
              className="pt-3 border-t border-white/[0.06] space-y-2 text-[11px]"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="font-sans font-medium text-zinc-300">
                  Mayan Tzolk&apos;in Directions
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums text-[11px]">
                  {(
                    [
                      ['East', 'Red'],
                      ['North', 'White'],
                      ['West', 'Black'],
                      ['South', 'Yellow'],
                    ] as const
                  ).map(([dir, color]) => {
                    const dCount = teamBalance.mayanDirectionDistribution[dir];
                    const isPlayerDir = teamBalance.playerProfile.mayanDirection === dir;
                    return (
                      <span
                        key={dir}
                        className={isPlayerDir ? 'text-amber-200 font-medium' : 'text-zinc-400'}
                      >
                        {dir} ({color}) <span className="text-zinc-200">{dCount}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="text-zinc-300">
                {!teamBalance.isFreeAgent && (
                  <TeamLogo
                    team={teamBalance.teamCode}
                    className="w-3.5 h-3.5 mr-1 align-[-2px]"
                  />
                )}
                {teamBalance.stackSummary}
              </div>
              {teamBalance.teammates.length > 0 && (
                <p className="text-zinc-400 leading-relaxed">
                  <span className="text-zinc-300 font-medium">
                    <TeamLogo
                      team={teamBalance.teamCode}
                      className="w-3.5 h-3.5 mr-1 align-[-2px]"
                    />
                    {teamBalance.teamCode} peers:
                  </span>{' '}
                  {teamBalance.unitMemberProfiles
                    .filter((m) => String(m.player.id) !== String(player.id))
                    .map((m) => {
                      const tmSurname =
                        m.player.last_name?.trim() ||
                        m.player.name.trim().split(/\s+/).slice(-1)[0] ||
                        m.player.name;
                      const tags = [m.zodiacElement, m.wuXingPhase].filter(Boolean).join('/');
                      return `${tmSurname} (${m.player.position}${tags ? ` · ${tags}` : ''})`;
                    })
                    .join(' · ')}
                </p>
              )}
            </div>
          </section>

          {/* Esoteric Contest Chart & Natal Signatures */}
          <dl
            data-testid="modal-venue-ephemeris"
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs border-b border-white/[0.08] pb-4"
          >
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-zinc-400 font-sans text-[11px]">Next-Game Contest Chart</dt>
              <dd className="text-zinc-100 font-sans font-medium mt-0.5 flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  {forecast.matchup.stadiumName ?? 'TBD'}
                  {forecast.matchup.city && forecast.matchup.state
                    ? ` (${forecast.matchup.city}, ${forecast.matchup.state})`
                    : ''}
                </span>
                <span className="font-mono tabular-nums text-[11px] text-zinc-400">
                  {[
                    forecast.matchup.planetaryHourRuler
                      ? `Hour of ${forecast.matchup.planetaryHourRuler}`
                      : null,
                    forecast.matchup.rokuyoDay ? `Rokuyo ${forecast.matchup.rokuyoDay}` : null,
                    forecast.matchup.geomanticJudge ?? null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '-'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400 font-sans text-[11px]">Western &amp; Decan</dt>
              <dd className="text-zinc-100 font-sans font-medium mt-0.5 break-words leading-snug">
                {[
                  forecast.natalProfile.sunSign,
                  forecast.natalProfile.element,
                  forecast.natalProfile.decanRuler
                    ? `${forecast.natalProfile.decanRuler} ruler`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400 font-sans text-[11px]">Vedic Moon</dt>
              <dd className="text-zinc-100 font-sans font-medium mt-0.5 break-words leading-snug">
                {[forecast.natalProfile.vedicNakshatra, forecast.natalProfile.vedicMoonRashi]
                  .filter(Boolean)
                  .join(' · ') || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400 font-sans text-[11px]">Chinese Four Pillars</dt>
              <dd className="text-zinc-100 font-sans font-medium mt-0.5 break-words leading-snug">
                {forecast.natalProfile.dayMasterStem && forecast.natalProfile.dayMasterPhase
                  ? `${forecast.natalProfile.dayMasterStem} ${forecast.natalProfile.dayMasterPhase}${
                      forecast.natalProfile.branchAnimal
                        ? ` · ${forecast.natalProfile.branchAnimal}`
                        : ''
                    }`
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400 font-sans text-[11px]">Runes, Trees &amp; Kabbalah</dt>
              <dd className="text-zinc-100 font-sans font-medium mt-0.5 break-words leading-snug">
                {[
                  forecast.natalProfile.natalRune,
                  forecast.natalProfile.natalOgham,
                  forecast.natalProfile.natalSephirah,
                ]
                  .filter(Boolean)
                  .join(' · ') || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400 font-sans text-[11px]">Mayan &amp; Yearly Ruler</dt>
              <dd className="text-zinc-100 font-sans font-medium mt-0.5 break-words leading-snug">
                {[
                  forecast.natalProfile.mayanNahual
                    ? `Tone ${forecast.natalProfile.mayanTone} ${forecast.natalProfile.mayanNahual}`
                    : null,
                  forecast.natalProfile.profectedHouse && forecast.natalProfile.timeLordPlanet
                    ? `House ${forecast.natalProfile.profectedHouse} · ${forecast.natalProfile.timeLordPlanet}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400 font-sans text-[11px]">Numerology &amp; Tarot</dt>
              <dd className="text-zinc-100 font-sans font-medium mt-0.5 break-words leading-snug">
                {[
                  forecast.natalProfile.lifePath ? `Life Path ${forecast.natalProfile.lifePath}` : null,
                  forecast.natalProfile.tarotCard,
                  forecast.natalProfile.hexagramNumber
                    ? `Hexagram ${forecast.natalProfile.hexagramNumber}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '-'}
              </dd>
            </div>
          </dl>

          {/* Active Historical Predictor Breakdown (Disabled Predictors Hidden) */}
          <section
            data-testid="predictor-breakdown-section"
            aria-label="Historical predictor breakdown"
            className="border-b border-white/[0.08] pb-4 space-y-3.5 text-xs"
          >
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h3 className="font-sans text-xs font-semibold text-zinc-200">
                Historical Predictor Breakdown
              </h3>
              <div className="flex items-center gap-2.5 flex-wrap font-mono tabular-nums text-[11px] text-zinc-400">
                <span>
                  {enabledPredictorCount} active · {forecast.positionModel.position} history ({forecast.positionModel.sampleSize.toLocaleString()} games)
                </span>
                <a
                  href={GITHUB_EMPIRICAL_STUDY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="modal-study-github-link"
                  className="inline-flex items-center gap-1 text-zinc-300 hover:text-zinc-100 underline underline-offset-2"
                >
                  <span>Full study</span>
                  <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                </a>
              </div>
            </div>

            {enabledPredictorCount === 0 ? (
              <div className="rounded-lg border border-white/[0.08] bg-[#101216] px-3 py-2.5 text-zinc-400 font-sans">
                No predictors are turned on. Enable predictors in the Predictors drawer to see how each tradition scores this matchup.
              </div>
            ) : (
              <div className="space-y-3.5">
                {PREDICTOR_CATEGORIES.map((cat) => {
                  const activeInCat = enabledSystems.filter((s) => s.categoryId === cat.id);
                  if (activeInCat.length === 0) return null;
                  const catActiveSum = activeInCat.reduce(
                    (acc, s) =>
                      acc +
                      (enabledPredictorCount === 1
                        ? s.standalonePointDiff
                        : s.jointContributionPts),
                    0,
                  );

                  return (
                    <div
                      key={cat.id}
                      data-testid={`modal-predictor-category-${cat.id}`}
                      className="space-y-2"
                    >
                      <div className="flex items-baseline justify-between gap-2 px-0.5">
                        <div className="min-w-0">
                          <span className="font-sans text-[11px] font-semibold text-zinc-200">
                            {cat.label}
                          </span>
                          <span className="font-sans text-[10px] text-zinc-400 ml-1.5">
                            ({activeInCat.length} active)
                          </span>
                        </div>
                        <span
                          className={`font-mono tabular-nums text-[11px] font-semibold shrink-0 ${modifierTextColor(catActiveSum)}`}
                        >
                          {formatSignedModifier(catActiveSum)} pts
                        </span>
                      </div>

                      <div className="space-y-2">
                        {activeInCat.map((sys) => {
                          const displayDelta =
                            enabledPredictorCount === 1
                              ? sys.standalonePointDiff
                              : sys.jointContributionPts;
                          const absHalfWidth = Math.min(
                            50,
                            Math.max(displayDelta !== 0 ? 3 : 0, (Math.abs(displayDelta) / 1.0) * 50),
                          );
                          const isModalInfoOpen = activePredictorInfoId === sys.systemId;

                          return (
                            <div
                              key={sys.systemId}
                              data-testid={`predictor-row-${sys.systemId}`}
                              className="rounded-lg border border-white/[0.08] bg-[#101216] px-3 py-2.5 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                  <span className="font-sans font-medium text-xs text-zinc-100">
                                    {sys.shortName}
                                  </span>
                                  <span className="font-mono text-[10px] text-zinc-400">
                                    {sys.subCategory}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActivePredictorInfoId(
                                        isModalInfoOpen ? null : sys.systemId,
                                      )
                                    }
                                    aria-label={`Explain ${sys.shortName}`}
                                    data-testid={`modal-predictor-tooltip-btn-${sys.systemId}`}
                                    className="text-zinc-400 hover:text-zinc-200 transition-colors p-1.5 -m-1 cursor-pointer"
                                  >
                                    <HelpCircle className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span
                                  className={`font-mono tabular-nums text-xs font-semibold shrink-0 ${modifierTextColor(displayDelta)}`}
                                >
                                  {formatSignedModifier(displayDelta)} pts
                                </span>
                              </div>

                              {isModalInfoOpen && (
                                <div
                                  data-testid={`modal-predictor-info-${sys.systemId}`}
                                  className="p-2.5 rounded-md bg-[#16181d] border border-white/10 text-[11px] font-sans space-y-1.5 text-zinc-300"
                                >
                                  <p className="leading-relaxed">{sys.description}</p>
                                  <div>
                                    <a
                                      href={sys.sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      data-testid={`modal-predictor-source-link-${sys.systemId}`}
                                      className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 underline underline-offset-2 font-medium"
                                    >
                                      <span>{sys.sourceLabel}</span>
                                      <ExternalLink
                                        className="w-3 h-3 shrink-0"
                                        aria-hidden="true"
                                      />
                                    </a>
                                  </div>
                                </div>
                              )}

                              <div className="relative h-1.5 w-full rounded-full bg-zinc-900 overflow-hidden">
                                <span
                                  className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20 z-[1]"
                                  aria-hidden="true"
                                />
                                {displayDelta > 0.005 && (
                                  <div
                                    className="absolute top-0 bottom-0 bg-emerald-400/80 rounded-r-full"
                                    style={{ left: '50%', width: `${absHalfWidth}%` }}
                                  />
                                )}
                                {displayDelta < -0.005 && (
                                  <div
                                    className="absolute top-0 bottom-0 bg-rose-400/80 rounded-l-full"
                                    style={{ right: '50%', width: `${absHalfWidth}%` }}
                                  />
                                )}
                              </div>

                              {sys.matchedConditions.length > 0 ? (
                                <ul className="space-y-1 pt-0.5">
                                  {sys.matchedConditions.map((cond) => {
                                    const condDelta =
                                      enabledPredictorCount === 1
                                        ? cond.standaloneWeightPts
                                        : cond.jointRidgeWeightPts;
                                    return (
                                      <li
                                        key={cond.conditionId}
                                        className="flex items-baseline justify-between gap-2 text-[11px]"
                                      >
                                        <span className="font-sans text-zinc-300 leading-snug">
                                          {cond.label}
                                        </span>
                                        <span className="font-mono tabular-nums text-[10px] text-zinc-400 shrink-0">
                                          <span className={modifierTextColor(condDelta)}>
                                            Avg {formatSignedModifier(condDelta)} pts
                                          </span>
                                          {' · '}{cond.positionalSampleSize.toLocaleString()} games
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p className="text-[11px] font-sans text-zinc-400">
                                  No special rule triggered this week · small average offset
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Roster Role Comparison / Multi-Candidate Comparison */}
          <div
            data-testid="roster-role-comparison"
            className="space-y-3 text-xs"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsRoleCompOpen((v) => !v)}
                aria-expanded={isRoleCompOpen}
                aria-controls={contentId}
                className="flex items-center gap-1.5 font-sans text-xs font-semibold text-zinc-200 hover:text-zinc-100 transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <span>
                  {isMultiCompare && !showRoster
                    ? `Comparing ${compareCandidates!.length} Selected Candidates`
                    : headToHead
                    ? `${player.name} vs. ${compareWith?.name}`
                    : isMine
                    ? `Compare vs. Other ${player.position}s`
                    : `Role Comparison (${player.position})`}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                    isRoleCompOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isMultiCompare ? (
                <button
                  type="button"
                  onClick={() => setShowRoster((v) => !v)}
                  className="text-xs font-sans font-medium text-amber-300 hover:text-amber-200 underline cursor-pointer"
                >
                  {showRoster
                    ? `Back to ${compareCandidates!.length} candidates`
                    : `Compare with your ${player.position}s`}
                </button>
              ) : compareWith ? (
                <button
                  type="button"
                  onClick={() => setShowRoster((v) => !v)}
                  className="text-xs font-sans font-medium text-amber-300 hover:text-amber-200 underline cursor-pointer"
                >
                  {headToHead ? `Compare with all your ${player.position}s` : `Back to ${compareWith.name}`}
                </button>
              ) : (
                <span className="text-xs font-sans text-zinc-400">
                  {teammates.length} {isMine ? 'other ' : ''}
                  {player.position}
                  {teammates.length === 1 ? '' : 's'} on roster
                </span>
              )}
            </div>

            <div id={contentId} className={isRoleCompOpen ? 'space-y-2.5' : 'hidden space-y-2.5'}>
              {isMultiCompare && !showRoster ? (
                <div
                  data-testid="multi-candidate-grid"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
                >
                  {compareCandidates!.map((cand, idx) => {
                    const candMetrics = getPlayerDisplayMetrics(cand);
                    const candRosterInfo = getPlayerRosterInfo(cand);
                    const roleLabel = getPlayerRoleLabel(cand, candRosterInfo.isMine, 'Candidate');
                    const isLeader = String(cand.id) === bestCandidateId;
                    return (
                      <div
                        key={cand.id}
                        data-testid={`candidate-card-${cand.id}`}
                        className={`p-3 rounded-lg border flex flex-col justify-between gap-2 ${
                          isLeader
                            ? 'bg-amber-500/[0.06] border-amber-400/40'
                            : 'bg-[#0f1012] border-white/[0.08]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[10px] font-mono tabular-nums text-zinc-400">
                              #{idx + 1}
                            </span>
                            <span className={`text-[10px] font-sans font-medium ${isLeader ? 'text-amber-300' : 'text-zinc-400'}`}>
                              {isLeader ? 'Leader' : roleLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <PlayerHeadshot player={cand} size="sm" />
                            <div className="min-w-0 flex-1">
                              <span className="font-sans font-medium text-xs text-zinc-100 break-words leading-snug block">
                                {cand.name}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <PositionalBadge position={cand.position} depth={cand.depth_chart_order} size="sm" />
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  <TeamLogo team={cand.team} className="w-3.5 h-3.5 mr-1 align-[-2px]" />
                                  {cand.team || 'FA'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1 text-center text-[10px] pt-2 border-t border-white/[0.06]">
                          <div>
                            <span className="text-[9px] font-sans text-zinc-400 block">Base</span>
                            <span className="font-mono tabular-nums text-zinc-200 font-medium block">
                              {candMetrics.base.toFixed(1)}
                              {candMetrics.placeholder.hasPlaceholder && (
                                <OraclePlaceholderMarker placeholder={candMetrics.placeholder} kind="stats" />
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-sans text-zinc-400 block">Modifier</span>
                            <span
                              className={`font-mono tabular-nums font-semibold block ${modifierTextColor(
                                candMetrics.modifier,
                              )}`}
                            >
                              {formatSignedModifier(candMetrics.modifier)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-sans text-amber-200/90 block">Projected</span>
                            <span className="font-mono tabular-nums text-amber-200 font-semibold block">
                              {candMetrics.net.toFixed(1)}
                              {candMetrics.placeholder.hasPlaceholder && (
                                <OraclePlaceholderMarker placeholder={candMetrics.placeholder} />
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : comparisonRows.length === 0 ? (
                <div className="py-2 text-zinc-400 font-sans text-xs">
                  {isMine
                    ? `${player.name} is your only ${player.position}.`
                    : `No rostered ${player.position}s on your squad. ${player.name} would fill an open ${player.position} slot.`}
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-[#0f1012] overflow-hidden">
                  {comparisonRows.map(({ slotLabel, rosterPlayer }) => {
                    const isSelf = String(rosterPlayer.id) === String(player.id);
                    const rosterPlayerInfo = getPlayerRosterInfo(rosterPlayer);

                    const swapSides =
                      headToHead &&
                      ((inspectedRosterInfo.isMine && !rosterPlayerInfo.isMine) ||
                       (inspectedRosterInfo.isMine &&
                        rosterPlayerInfo.isMine &&
                        inspectedRosterInfo.isStarter &&
                        !rosterPlayerInfo.isStarter));

                    const leftPlayer = swapSides ? player : rosterPlayer;
                    const rightPlayer = swapSides ? rosterPlayer : player;

                    const leftInfo = swapSides ? inspectedRosterInfo : rosterPlayerInfo;
                    const rightInfo = swapSides ? rosterPlayerInfo : inspectedRosterInfo;

                    const isLeftMine = leftInfo.isMine;
                    const isRightMine = rightInfo.isMine;

                    const leftMetrics = getPlayerDisplayMetrics(leftPlayer);
                    const rightMetrics = getPlayerDisplayMetrics(rightPlayer);

                    const baseDiff = rightMetrics.base - leftMetrics.base;
                    const modDiff = rightMetrics.modifier - leftMetrics.modifier;
                    const netDiff = rightMetrics.net - leftMetrics.net;
                    const isUpgrade = netDiff > 0.2;

                    const leftTitle = headToHead
                      ? isLeftMine && isRightMine
                        ? getIntraRosterSlotLabel(leftInfo, 'Roster')
                        : getPlayerRoleLabel(leftPlayer, isLeftMine, 'Player')
                      : slotLabel === 'ROSTER'
                      ? 'Roster'
                      : `Roster (${slotLabel})`;

                    const rightTitle = headToHead
                      ? isLeftMine && isRightMine
                        ? getIntraRosterSlotLabel(rightInfo, 'Roster')
                        : getPlayerRoleLabel(rightPlayer, isRightMine, 'Candidate')
                      : isMine
                      ? `Inspected (${player.position})`
                      : `Candidate (${player.position})`;

                    const fmtDiff = (d: number, decimals = 1) =>
                      `${d >= 0 ? '+' : ''}${d.toFixed(decimals)}`;

                    return (
                      <div
                        key={`${slotLabel}-${rosterPlayer.id}`}
                        data-testid={`role-comp-row-${rosterPlayer.id}`}
                        className="p-3 space-y-2.5"
                      >
                        <div className="grid grid-cols-2 gap-3 divide-x divide-white/[0.06]">
                          <div className="flex items-start justify-between gap-2 pr-1">
                            <div className="min-w-0">
                              <span className="text-[10px] font-sans text-zinc-400 block">{leftTitle}</span>
                              <span className="font-sans font-medium text-xs text-zinc-100 break-words leading-snug block">
                                {leftPlayer.name} (
                                <TeamLogo
                                  team={leftPlayer.team}
                                  className="w-3.5 h-3.5 mr-1 align-[-2px]"
                                />
                                {leftPlayer.team})
                              </span>
                            </div>
                            <span className="text-xs font-mono tabular-nums font-semibold text-zinc-200 shrink-0">
                              {leftMetrics.net.toFixed(1)}
                              {leftMetrics.placeholder.hasPlaceholder && (
                                <OraclePlaceholderMarker placeholder={leftMetrics.placeholder} />
                              )}
                            </span>
                          </div>

                          <div className="flex items-start justify-between gap-2 pl-3">
                            <div className="min-w-0">
                              <span className="text-[10px] font-sans text-zinc-400 block">{rightTitle}</span>
                              <span className="font-sans font-medium text-xs text-zinc-100 break-words leading-snug block">
                                {rightPlayer.name} (
                                <TeamLogo
                                  team={rightPlayer.team}
                                  className="w-3.5 h-3.5 mr-1 align-[-2px]"
                                />
                                {rightPlayer.team})
                              </span>
                            </div>
                            <span className="text-xs font-mono tabular-nums font-semibold text-amber-300 shrink-0">
                              {rightMetrics.net.toFixed(1)}
                              {rightMetrics.placeholder.hasPlaceholder && (
                                <OraclePlaceholderMarker placeholder={rightMetrics.placeholder} />
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] pt-2 border-t border-white/[0.05]">
                          <span className="text-zinc-400">
                            {headToHead ? 'Head-to-head' : slotLabel === 'ROSTER' ? 'Roster' : slotLabel}
                          </span>
                          <span className={`font-mono tabular-nums font-medium ${isUpgrade ? 'text-emerald-300' : 'text-zinc-300'}`}>
                            {isSelf
                              ? 'Currently inspected'
                              : headToHead
                              ? netDiff >= 0
                                ? `${rightPlayer.name} by +${Math.abs(netDiff).toFixed(1)} pts`
                                : `${leftPlayer.name} by +${Math.abs(netDiff).toFixed(1)} pts`
                              : isMine
                              ? netDiff >= 0
                                ? `Ahead of ${leftPlayer.name} (${fmtDiff(netDiff)} pts)`
                                : `Behind ${leftPlayer.name} (${fmtDiff(netDiff)} pts)`
                              : isUpgrade
                              ? `Upgrade (${fmtDiff(netDiff)} net pts)`
                              : `Keep ${leftPlayer.name} (${fmtDiff(netDiff)} pts)`}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-1.5 border-t border-white/[0.05]">
                          <div>
                            <span className="font-sans text-zinc-400 block">Base</span>
                            <span className="font-mono tabular-nums text-zinc-200">
                              {rightMetrics.base.toFixed(1)} vs {leftMetrics.base.toFixed(1)}
                            </span>{' '}
                            <span className={`font-mono tabular-nums font-medium ${baseDiff > 0 ? 'text-emerald-300' : baseDiff < 0 ? 'text-rose-300' : 'text-zinc-400'}`}>
                              ({fmtDiff(baseDiff)})
                            </span>
                          </div>
                          <div>
                            <span className="font-sans text-zinc-400 block">Modifier</span>
                            <span className="font-mono tabular-nums text-zinc-200">
                              {formatSignedModifier(rightMetrics.modifier)} vs {formatSignedModifier(leftMetrics.modifier)}
                            </span>{' '}
                            <span className={`font-mono tabular-nums font-medium ${modDiff > 0 ? 'text-emerald-300' : modDiff < 0 ? 'text-rose-300' : 'text-zinc-400'}`}>
                              ({formatSignedModifier(modDiff)})
                            </span>
                          </div>
                          <div>
                            <span className="font-sans text-amber-200/90 block">Projected</span>
                            <span className="font-mono tabular-nums text-amber-200 font-semibold">
                              {rightMetrics.net.toFixed(1)} vs {leftMetrics.net.toFixed(1)}
                            </span>{' '}
                            <span className={`font-mono tabular-nums font-medium ${netDiff > 0 ? 'text-emerald-300' : netDiff < 0 ? 'text-rose-300' : 'text-zinc-400'}`}>
                              ({fmtDiff(netDiff)})
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerDetailModal;

interface ProjectRadarPolygonOptions {
  readonly norms: readonly number[];
  readonly cx?: number;
  readonly cy?: number;
  readonly maxR?: number;
  readonly angles?: readonly number[];
}

function projectRadarPolygon({
  norms,
  cx = RADAR_CX,
  cy = RADAR_CY,
  maxR = RADAR_MAX_R,
  angles = RADAR_SPOKE_ANGLES,
}: ProjectRadarPolygonOptions): { pts: Array<{ x: number; y: number }>; polygonString: string } {
  const pts = norms.map((norm, i) => {
    const rad = ((angles[i] ?? 0) * Math.PI) / 180;
    const r = norm * maxR;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  });
  const polygonString = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return { pts, polygonString };
}
