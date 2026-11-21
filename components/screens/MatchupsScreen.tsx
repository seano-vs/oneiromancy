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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PositionalBadge from '@/components/common/PositionalBadge';
import RosterSlotBadge from '@/components/common/RosterSlotBadge';
import PlayerHeadshot, { TeamLogo } from '@/components/common/PlayerHeadshot';
import UserAvatar from '@/components/common/UserAvatar';
import OraclePlaceholderMarker from '@/components/common/OraclePlaceholderMarker';
import PowerupStars, { LeaderStarryAura } from '@/components/common/PowerupStars';
import PlayerDetailModal from '@/components/modals/PlayerDetailModal';
import type { InspectTarget } from '@/components/common/PlayerLink';
import { useOneiromancy } from '@/context/OneiromancyContext';
import { mockMatchupWeeks, mockPlayerFavorabilities, mockWeeklyMatchup } from '@/lib/mockData';
import { stripUserSuffix } from '@/lib/scoring';
import {
  DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS,
  buildUnitMap,
  computeLineupCheck,
  currentWeekOracleScore,
  formatSignedModifier,
  modifierTextColor,
  oraclePlaceholderInfo,
  playerModifier,
  resolveActiveWeek,
  statsPoints,
} from '@/lib/oracle';
import { kickoffLabel, moonAt, neutralVenueCoords, planetaryHourAt, teamGame } from '@/lib/nflGames';
import { buildStarterPairs, deriveEligiblePositions, deriveWeeklyMatchup, extractStartingSlots, getSeasonContext, isNFLByeWeek, isPlayerOnByeWeek } from '@/lib/sleeper';
import type { CosmicPlayer, MatchupWeekData, PlayerMatchupFavorability, WeeklyMatchup } from '@/types/oneiromancy';
import { ArrowUpDown, Moon, Sparkles } from 'lucide-react';

export interface MatchupsScreenProps {
  weeklyMatchup?: WeeklyMatchup | null;
  className?: string;
  embedded?: boolean;
  part?: 'all' | 'comparison' | 'details';
}

export const MatchupsScreen: React.FC<MatchupsScreenProps> = ({
  weeklyMatchup: propWeeklyMatchup,
  className = '',
  embedded = false,
  part = 'all',
}) => {
  const context = useOneiromancy();
  const showComparison = part !== 'details';
  const showDetails = part !== 'comparison';
  const [inspected, setInspected] = useState<InspectTarget | null>(null);

  const contextWeek = context.draftState?.weekly_matchup?.week;
  const upcomingMatchups = context.draftState?.weekly_matchup?.upcoming_matchups;
  const resolveActiveMatchupWeek = useCallback(() => {
    if (propWeeklyMatchup?.week) return propWeeklyMatchup.week;
    if (typeof window !== 'undefined' && window.location?.search) {
      const wParam = Number(new URLSearchParams(window.location.search).get('week'));
      if (Number.isFinite(wParam) && wParam >= 1 && wParam <= 18) return wParam;
    }
    const isMock = Boolean(
      context.draftState &&
      !context.draftState.isLive &&
      context.draftState.mode !== 'live'
    );
    if (isMock) {
      return resolveActiveWeek(context.draftState);
    }
    if (contextWeek) return contextWeek;
    if (upcomingMatchups?.length) {
      return (
        upcomingMatchups.find((m) => m.status === 'active')?.week ||
        upcomingMatchups.find((m) => m.is_upcoming)?.week ||
        upcomingMatchups[0].week
      );
    }
    return resolveActiveWeek(context.draftState);
  }, [propWeeklyMatchup?.week, context.draftState, contextWeek, upcomingMatchups]);

  const [selectedWeek, setSelectedWeek] = useState<number>(() => resolveActiveMatchupWeek());
  const contextSyncKey = `${contextWeek ?? ''}|${context.draftState?.draft_id ?? ''}|${context.draftState?.settings?.league_id ?? ''}`;
  const prevContextSyncKeyRef = useRef<string>(contextSyncKey);

  useEffect(() => {
    if (propWeeklyMatchup?.week) setSelectedWeek(propWeeklyMatchup.week);
  }, [propWeeklyMatchup?.week]);

  useEffect(() => {
    if (!propWeeklyMatchup?.week && contextWeek !== undefined && contextSyncKey !== prevContextSyncKeyRef.current) {
      prevContextSyncKeyRef.current = contextSyncKey;
      setSelectedWeek(resolveActiveMatchupWeek());
    }
  }, [propWeeklyMatchup?.week, contextWeek, contextSyncKey, resolveActiveMatchupWeek]);

  const userSlot = context.userSlot;
  const settingsUserSlot = context.draftState?.settings?.user_slot;
  const userRosterId = context.userRosterId;
  const competitorTeams = context.draftState?.competitor_teams;
  const cosmicBoard = context.draftState?.cosmic_board;
  const myRoster = context.draftState?.my_roster;
  const existingMatchup = context.draftState?.weekly_matchup;
  const isLiveState = Boolean(context.draftState?.isLive || context.draftState?.mode === 'live');

  const matchupData = useMemo(() => {
    if (propWeeklyMatchup) return propWeeklyMatchup;
    const activeSlot = userSlot || settingsUserSlot || 7;
    const activeUserTeam = competitorTeams?.find((t) => t.is_user);
    const activeRosterId = activeUserTeam?.roster_id ?? userRosterId ?? activeSlot;
    const existing = existingMatchup;

    if (
      existing?.user_team &&
      (existing.user_team.roster_id === activeRosterId || existing.user_team.slot === activeSlot) &&
      (!selectedWeek || existing.week === selectedWeek)
    ) {
      return existing;
    }

    if (
      existing &&
      selectedWeek &&
      selectedWeek !== existing.week &&
      getSeasonContext() &&
      competitorTeams?.length
    ) {
      return deriveWeeklyMatchup(activeRosterId, competitorTeams, null, cosmicBoard, myRoster, selectedWeek);
    }

    if (existing?.upcoming_matchups?.length && selectedWeek && selectedWeek !== existing.week) {
      const matchForWeek = existing.upcoming_matchups.find((w) => w.week === selectedWeek);
      if (matchForWeek) {
        const derived = competitorTeams?.length
          ? deriveWeeklyMatchup(activeRosterId, competitorTeams, null, cosmicBoard, myRoster, selectedWeek)
          : null;
        return {
          ...existing,
          ...(derived || {}),
          week: matchForWeek.week,
          matchup_id: matchForWeek.matchup_id || derived?.matchup_id || existing.matchup_id,
          status:
            matchForWeek.status ||
            derived?.status ||
            (selectedWeek < existing.week ? 'completed' : 'upcoming'),
          date_range: matchForWeek.date_range || derived?.date_range,
          score_user: matchForWeek.score_user ?? derived?.score_user,
          score_opponent: matchForWeek.score_opponent ?? derived?.score_opponent,
          result: matchForWeek.result ?? derived?.result,
          upcoming_matchups: existing.upcoming_matchups,
          user_team: derived?.user_team || matchForWeek.user_team,
          opponent_team: derived?.opponent_team || matchForWeek.opponent_team,
          win_probability: derived?.win_probability ?? matchForWeek.win_probability,
          win_probability_label:
            derived?.win_probability_label ?? matchForWeek.win_probability_label,
          team_comparison: derived?.team_comparison || matchForWeek.team_comparison,
          player_favorabilities:
            derived?.player_favorabilities?.length
              ? derived.player_favorabilities
              : matchForWeek.player_favorabilities || [],
        };
      }
    }

    if (competitorTeams?.length) {
      return deriveWeeklyMatchup(activeRosterId, competitorTeams, null, cosmicBoard, myRoster, selectedWeek || 1);
    }
    if (existing) return existing;
    return isLiveState ? ({} as WeeklyMatchup) : mockWeeklyMatchup;
  }, [
    propWeeklyMatchup,
    userSlot,
    settingsUserSlot,
    userRosterId,
    competitorTeams,
    cosmicBoard,
    myRoster,
    existingMatchup,
    isLiveState,
    selectedWeek,
  ]);

  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const isLiveMode = Boolean(context.draftState?.isLive || context.draftState?.mode === 'live');

  const playerFavorabilities: PlayerMatchupFavorability[] = useMemo(() => {
    if (matchupData.player_favorabilities !== undefined) return matchupData.player_favorabilities;
    return isLiveMode ? [] : mockPlayerFavorabilities;
  }, [matchupData.player_favorabilities, isLiveMode]);

  const matchupWeeks: MatchupWeekData[] = useMemo(
    () => matchupData.upcoming_matchups || (isLiveMode ? [] : mockMatchupWeeks),
    [matchupData.upcoming_matchups, isLiveMode],
  );

  const currentWeekInfo = useMemo(() => {
    const found = matchupWeeks.find((w) => w.week === selectedWeek);
    if (found) return found;
    const activeWk = context.draftState?.weekly_matchup?.week || 2;
    const rawOppName = stripUserSuffix(matchupData.opponent_team?.team_name);
    return {
      week: selectedWeek,
      opponent_name: rawOppName || 'Matchup',
      opponent_owner: matchupData.opponent_team?.owner_name?.trim() || 'Manager',
      status: selectedWeek === activeWk ? ('active' as const) : selectedWeek < activeWk ? ('completed' as const) : ('upcoming' as const),
      date_range: matchupData.date_range || `Week ${selectedWeek}`,
    };
  }, [matchupWeeks, selectedWeek, matchupData, context.draftState?.weekly_matchup?.week]);

  const isFiniteNum = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);
  const userProjRaw = matchupData.user_team?.projected_points;
  const oppProjRaw = matchupData.opponent_team?.projected_points;
  const hasValidFinalScores =
    matchupData.status === 'completed' &&
    isFiniteNum(matchupData.score_user) &&
    isFiniteNum(matchupData.score_opponent);
  const hasExplicitInvalidProj =
    (userProjRaw !== undefined && !isFiniteNum(userProjRaw)) ||
    (oppProjRaw !== undefined && !isFiniteNum(oppProjRaw));
  const showFinalLabel = hasValidFinalScores;
  const userTeamName = stripUserSuffix(matchupData.user_team?.team_name, 'Team');
  const oppTeamName = stripUserSuffix(matchupData.opponent_team?.team_name, 'Matchup');

  const rawRosterPositions = context.draftState?.roster_positions || context.draftState?.settings?.roster_positions;
  const leagueEligiblePositions = useMemo(() => deriveEligiblePositions(rawRosterPositions, context.draftState?.my_roster), [rawRosterPositions, context.draftState?.my_roster]);
  const boardMap = useMemo(() => new Map((context.draftState?.cosmic_board || []).map((p) => [String(p.id), p])), [context.draftState?.cosmic_board]);

  const rosterPlayerById = useMemo(
    () =>
      new Map(
        (context.draftState?.my_roster || [])
          .filter((s) => s.player)
          .map((s) => [String(s.player!.id), s.player!]),
      ),
    [context.draftState?.my_roster],
  );

  const byePlayerIds = useMemo(() => {
    const ids = new Set<string>();
    const nflByeActive = isNFLByeWeek(selectedWeek);
    const season = getSeasonContext();
    for (const fav of playerFavorabilities) {
      const bp = boardMap.get(String(fav.player_id));
      const rp = rosterPlayerById.get(String(fav.player_id));
      const team = (fav.nfl_team || fav.team || bp?.team || rp?.team || '').toUpperCase();
      const explicitBye =
        fav.game_kickoff === 'Bye week' ||
        fav.game_kickoff === 'No game this week (Bye)' ||
        fav.stadium?.stadium_name === 'No game this week';
      if (
        explicitBye ||
        (nflByeActive &&
          isPlayerOnByeWeek(selectedWeek, fav.bye_week || bp?.bye_week || rp?.bye_week, team, season?.byeWeeks))
      ) {
        ids.add(String(fav.player_id));
      }
    }
    return ids;
  }, [playerFavorabilities, boardMap, rosterPlayerById, selectedWeek]);

  const toCosmicPlayer = useCallback(
    (
      fav: PlayerMatchupFavorability,
      isOnByeOverride?: boolean,
      fallbackBase?: CosmicPlayer | null,
    ): CosmicPlayer => {
      const bp = boardMap.get(String(fav.player_id));
      const rp = fallbackBase ?? rosterPlayerById.get(String(fav.player_id)) ?? null;
      const found: CosmicPlayer | null =
        bp && rp
          ? {
              ...bp,
              ...rp,
              spirit_score: bp.spirit_score ?? rp.spirit_score,
              divination_breakdown: bp.divination_breakdown ?? rp.divination_breakdown,
              average_projected_points: bp.average_projected_points ?? rp.average_projected_points ?? bp.baseline_projected_points ?? rp.baseline_projected_points,
              baseline_projected_points: bp.baseline_projected_points ?? rp.baseline_projected_points,
              next_play_week: bp.next_play_week ?? rp.next_play_week,
              next_week_projected_points: bp.next_week_projected_points ?? rp.next_week_projected_points,
              depth_chart_order: bp.depth_chart_order ?? rp.depth_chart_order ?? fav.depth_chart_order,
              birth_date: bp.birth_date ?? rp.birth_date,
            }
          : bp ?? rp ?? null;
      const isOnBye = isOnByeOverride !== undefined ? isOnByeOverride : byePlayerIds.has(String(fav.player_id));
      const rawPts = Number.isFinite(Number(fav.projected_points)) ? Number(fav.projected_points) : found ? statsPoints(found) : 12;
      const pts = isOnBye ? 0 : rawPts;
      const avgPts = found?.average_projected_points ?? found?.baseline_projected_points ?? (rawPts > 0 ? rawPts : undefined);
      if (found) {
        return {
          ...found,
          average_projected_points: avgPts,
          projected_points: pts,
          sleeper_projected_points: pts,
          weekly_projected_points: pts,
        };
      }
      const nameParts = (fav.player_name || 'Player').split(' ');
      return {
        id: String(fav.player_id), name: fav.player_name, first_name: nameParts[0] || fav.player_name,
        last_name: nameParts.slice(1).join(' ') || '', position: fav.position, team: fav.nfl_team || fav.team || 'NFL',
        birth_date: (fav as unknown as { birth_date?: string }).birth_date,
        jersey_number: (fav as unknown as { jersey_number?: number }).jersey_number ?? 0,
        bye_week: fav.bye_week || 0, depth_chart_order: fav.depth_chart_order, projected_points: pts, sleeper_projected_points: pts, weekly_projected_points: pts,
        average_projected_points: avgPts, baseline_projected_points: avgPts,
        adp: 0, market_vor: 0, vor_normalized: Math.min(100, (pts / 25) * 100),
        spirit_score: 75, harmony_score: 75, draft_score: pts, favorability_score: 75,
        divination_breakdown: { celestial: 75, numeric: 75, geomantic: 75, oracular: 75, harmony: 75 },
        elemental_traits: { sun_sign: '-', element: 'Fire', tarot_card: '-', life_path_number: 0, iching_hexagram: 0, gematria_resonance: 75 },
        draft_status: fav.is_user_team ? 'my_team' : 'drafted',
      };
    },
    [boardMap, byePlayerIds, rosterPlayerById],
  );

  const favById = useMemo(
    () => new Map(playerFavorabilities.map((fav) => [String(fav.player_id), fav])),
    [playerFavorabilities],
  );

  const weekAdjustedRoster = useMemo(() => {
    const rawRoster = context.draftState?.my_roster || [];
    const season = getSeasonContext();
    return rawRoster.map((slot) => {
      if (!slot.player) return slot;
      const p = slot.player;
      const pId = String(p.id);
      const fav = favById.get(pId);
      const team = (fav?.nfl_team || fav?.team || p.team || '').toUpperCase();
      const isOnBye =
        byePlayerIds.has(pId) ||
        isPlayerOnByeWeek(selectedWeek, fav?.bye_week || p.bye_week, team, season?.byeWeeks);

      if (fav) {
        return {
          ...slot,
          player: toCosmicPlayer(fav, isOnBye, p),
        };
      }

      if (isOnBye) {
        return {
          ...slot,
          player: {
            ...p,
            projected_points: 0,
            sleeper_projected_points: 0,
            weekly_projected_points: 0,
          },
        };
      }
      return slot;
    });
  }, [context.draftState?.my_roster, favById, byePlayerIds, toCosmicPlayer, selectedWeek]);

  const activeSystems = context.enabledSystems ?? DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS;
  const unitByTeam = useMemo(
    () => buildUnitMap(cosmicBoard ?? [], weekAdjustedRoster),
    [cosmicBoard, weekAdjustedRoster],
  );
  const swaps = useMemo(
    () =>
      computeLineupCheck(weekAdjustedRoster, undefined, selectedWeek, {
        currentWeek: selectedWeek,
        enabledSystems: activeSystems,
        unitByTeam,
      }),
    [weekAdjustedRoster, selectedWeek, activeSystems, unitByTeam],
  );
  const swapByStarterId = useMemo(() => new Map(swaps.filter((s) => s.playerOut).map((s) => [String(s.playerOut!.id), s])), [swaps]);
  const leagueStartingSlots = useMemo(() => extractStartingSlots(rawRosterPositions, context.draftState?.my_roster), [rawRosterPositions, context.draftState?.my_roster]);

  const userStarterIdSet = useMemo(
    () =>
      matchupData.user_team?.starters && matchupData.user_team.starters.length > 0
        ? new Set(matchupData.user_team.starters.filter((id) => id && String(id) !== '0').map(String))
        : null,
    [matchupData.user_team?.starters],
  );
  const oppStarterIdSet = useMemo(
    () =>
      matchupData.opponent_team?.starters && matchupData.opponent_team.starters.length > 0
        ? new Set(matchupData.opponent_team.starters.filter((id) => id && String(id) !== '0').map(String))
        : null,
    [matchupData.opponent_team?.starters],
  );

  const allUserStarters = useMemo(
    () =>
      playerFavorabilities.filter((p) => {
        if (!p.is_user_team || p.is_benched) return false;
        if (userStarterIdSet) return userStarterIdSet.has(String(p.player_id));
        return leagueEligiblePositions.includes(p.position);
      }),
    [playerFavorabilities, userStarterIdSet, leagueEligiblePositions],
  );
  const allOppStarters = useMemo(
    () =>
      playerFavorabilities.filter((p) => {
        if (p.is_user_team || p.is_benched) return false;
        if (oppStarterIdSet) return oppStarterIdSet.has(String(p.player_id));
        return leagueEligiblePositions.includes(p.position);
      }),
    [playerFavorabilities, oppStarterIdSet, leagueEligiblePositions],
  );

  const starterCardStats = useCallback(
    (s: PlayerMatchupFavorability): number => {
      if (byePlayerIds.has(String(s.player_id))) return 0;
      const raw = Number(s.projected_points ?? statsPoints(toCosmicPlayer(s)));
      return Number.isFinite(raw) ? Number(raw.toFixed(1)) : 0;
    },
    [byePlayerIds, toCosmicPlayer],
  );

  const starterCardModifier = useCallback(
    (s: PlayerMatchupFavorability): number => {
      if (byePlayerIds.has(String(s.player_id))) return 0;
      const cp = toCosmicPlayer(s, false);
      const mod = playerModifier(cp, {
        currentWeek: selectedWeek,
        enabledSystems: activeSystems,
        unitByTeam,
        placeholder: false,
        nextGameLookahead: false,
      });
      return Number.isFinite(mod) ? mod : 0;
    },
    [byePlayerIds, toCosmicPlayer, selectedWeek, activeSystems, unitByTeam],
  );

  const hasFiniteTeamProj = isFiniteNum(userProjRaw) && isFiniteNum(oppProjRaw);
  const hasStarterMatchupInputs =
    allUserStarters.length > 0 &&
    allOppStarters.length > 0 &&
    !hasExplicitInvalidProj;
  const hasMatchupMetrics = !isLiveMode
    ? !hasExplicitInvalidProj
    : hasStarterMatchupInputs || hasFiniteTeamProj;

  const userProj = useMemo(() => {
    if (allUserStarters.length > 0) {
      const sum = allUserStarters.reduce((acc, s) => acc + starterCardStats(s), 0);
      return Number.isFinite(sum) ? Math.round(sum * 100) / 100 : 0;
    }
    if (isFiniteNum(userProjRaw)) return userProjRaw;
    return !hasExplicitInvalidProj && !isLiveMode ? 125.0 : 0;
  }, [allUserStarters, starterCardStats, userProjRaw, hasExplicitInvalidProj, isLiveMode]);

  const oppProj = useMemo(() => {
    if (allOppStarters.length > 0) {
      const sum = allOppStarters.reduce((acc, s) => acc + starterCardStats(s), 0);
      return Number.isFinite(sum) ? Math.round(sum * 100) / 100 : 0;
    }
    if (isFiniteNum(oppProjRaw)) return oppProjRaw;
    return !hasExplicitInvalidProj && !isLiveMode ? 110.0 : 0;
  }, [allOppStarters, starterCardStats, oppProjRaw, hasExplicitInvalidProj, isLiveMode]);

  const userModTotal = useMemo(() => {
    if (!hasMatchupMetrics || allUserStarters.length === 0) return 0;
    const sum = allUserStarters.reduce((acc, s) => acc + starterCardModifier(s), 0);
    return Number.isFinite(sum) ? Math.round(sum * 100) / 100 : 0;
  }, [hasMatchupMetrics, allUserStarters, starterCardModifier]);

  const oppModTotal = useMemo(() => {
    if (!hasMatchupMetrics || allOppStarters.length === 0) return 0;
    const sum = allOppStarters.reduce((acc, s) => acc + starterCardModifier(s), 0);
    return Number.isFinite(sum) ? Math.round(sum * 100) / 100 : 0;
  }, [hasMatchupMetrics, allOppStarters, starterCardModifier]);

  const userNetTotal = useMemo(
    () => (hasMatchupMetrics ? Math.round((userProj + userModTotal) * 100) / 100 : 0),
    [hasMatchupMetrics, userProj, userModTotal],
  );
  const oppNetTotal = useMemo(
    () => (hasMatchupMetrics ? Math.round((oppProj + oppModTotal) * 100) / 100 : 0),
    [hasMatchupMetrics, oppProj, oppModTotal],
  );

  const playersOnBye = useMemo(
    () => playerFavorabilities.filter((fav) => byePlayerIds.has(String(fav.player_id))),
    [playerFavorabilities, byePlayerIds],
  );

  // Pair user starters and opponent starters into head-to-head slot rows in Sleeper league starting order
  const starterPairs = useMemo(
    () =>
      buildStarterPairs(
        leagueStartingSlots,
        allUserStarters,
        allOppStarters,
        matchupData.user_team?.starters,
        matchupData.opponent_team?.starters,
      ),
    [leagueStartingSlots, allUserStarters, allOppStarters, matchupData.user_team?.starters, matchupData.opponent_team?.starters],
  );

  const displayedPairs = useMemo(() => {
    if (positionFilter === 'ALL') return starterPairs;
    return starterPairs.filter(
      (pair) =>
        pair.user?.position === positionFilter ||
        pair.opp?.position === positionFilter ||
        pair.slotRole === positionFilter ||
        pair.slotLabel === positionFilter,
    );
  }, [starterPairs, positionFilter]);

  const kickoffSky = useMemo(() => {
    const sampleTeam = playerFavorabilities[0]?.nfl_team || playerFavorabilities[0]?.team;
    const schedGame = sampleTeam ? teamGame(selectedWeek, sampleTeam) : undefined;
    const seasonYear = Number(getSeasonContext()?.season) || 2025;
    const fallbackUtc = new Date(Date.UTC(seasonYear, 8, 7 + Math.max(0, selectedWeek - 1) * 7, 17, 0, 0)).toISOString();
    const effectiveGame = schedGame ?? {
      week: selectedWeek,
      home: sampleTeam || 'KC',
      away: 'OPP',
      kickoff: fallbackUtc,
      date: fallbackUtc.slice(0, 10),
      venue: null,
      neutral: false,
    };
    const refDate = new Date(effectiveGame.kickoff || fallbackUtc);
    const homeFav = playerFavorabilities.find((pf) => (pf.nfl_team || pf.team) === effectiveGame.home);
    const refLon =
      neutralVenueCoords(effectiveGame.venue?.name)?.lon ??
      homeFav?.stadium?.longitude ??
      playerFavorabilities[0]?.stadium?.longitude ??
      0;
    return {
      label: kickoffLabel(effectiveGame),
      moon: moonAt(refDate),
      hour: planetaryHourAt(refDate, Number(refLon) || 0),
    };
  }, [selectedWeek, playerFavorabilities]);

  const openFavPlayer = (fav: PlayerMatchupFavorability, vsPlayer: CosmicPlayer | null = null) => {
    const isOnBye = byePlayerIds.has(String(fav.player_id));
    setInspected({ player: toCosmicPlayer(fav, isOnBye), vs: vsPlayer });
  };

  const renderPlayerCard = (
    player: PlayerMatchupFavorability,
    isMutedBench: boolean,
    idx: number,
    vsStarter: PlayerMatchupFavorability | null = null,
    isFavoredInMatchup: boolean = false,
  ) => {
    const isOnBye = byePlayerIds.has(String(player.player_id));
    const isCardDominant = isFavoredInMatchup && !isOnBye;
    const cp = toCosmicPlayer(player, isOnBye);
    const placeholder = oraclePlaceholderInfo(cp, selectedWeek);

    const stats = starterCardStats(player);
    const modPts = isOnBye ? 0 : starterCardModifier(player);
    const netPts = Math.round((stats + modPts) * 100) / 100;
    const swap = player.is_user_team && !isMutedBench ? swapByStarterId.get(String(player.player_id)) : undefined;

    const isByeStadium =
      isOnBye ||
      player.stadium?.stadium_name === 'No game this week' ||
      player.game_kickoff === 'Bye week' ||
      player.game_kickoff === 'No game this week (Bye)';
    const stadiumDisplay = isByeStadium
      ? 'No game this week (Bye)'
      : (player.stadium?.stadium_name || 'NFL Stadium');
    const kickoffDisplay = isByeStadium
      ? 'Bye week'
      : (player.game_kickoff || 'Time TBA');
    const latVal = player.stadium?.latitude ?? player.stadium?.coordinates?.lat;
    const lonVal = player.stadium?.longitude ?? player.stadium?.coordinates?.lon;
    const coordText =
      !isByeStadium &&
      typeof latVal === 'number' &&
      typeof lonVal === 'number' &&
      Number.isFinite(latVal) &&
      Number.isFinite(lonVal)
        ? `${Math.abs(latVal).toFixed(2)}°${latVal >= 0 ? 'N' : 'S'}, ${Math.abs(lonVal).toFixed(2)}°${lonVal >= 0 ? 'E' : 'W'}`
        : '';
    const cleanRationale = (player.astrological_rationale || player.rationale || '')
      .replace(/^[^\p{L}\p{N}]+/u, '')
      .trim();
    const visibleCelestialLine = !isByeStadium
      ? [player.lunar_phase, player.planetary_hour, coordText].filter(Boolean).join(' · ')
      : '';
    const celestialNoteId = `matchup-celestial-${selectedWeek}-${player.is_user_team ? 'u' : 'o'}-${player.player_id}-${idx}`;
    const rationaleNoteId = `matchup-rationale-${selectedWeek}-${player.is_user_team ? 'u' : 'o'}-${player.player_id}-${idx}`;
    const describedByIds =
      [visibleCelestialLine ? celestialNoteId : '', cleanRationale ? rationaleNoteId : '']
        .filter(Boolean)
        .join(' ') || undefined;
    const compareTarget = swap?.playerIn ?? (vsStarter ? toCosmicPlayer(vsStarter) : null);

    const modColor = modifierTextColor(modPts);
    const isRightSide = !player.is_user_team;
    const playerTeamCode = player.nfl_team || player.team || 'FA';
    const playerByeWeek = Number(cp.bye_week) || 0;
    const byeCutoffWeek = Math.max(selectedWeek, resolveActiveWeek(context.draftState));
    const showUpcomingBye = !isOnBye && playerByeWeek >= byeCutoffWeek;

    return (
      <div
        key={`${selectedWeek}-${player.is_user_team ? 'u' : 'o'}-${player.player_id}-${idx}`}
        data-testid={!isMutedBench ? `matchup-starter-card-${player.player_id}` : undefined}
        data-dominant={isCardDominant ? 'true' : 'false'}
        onClick={() => openFavPlayer(player, compareTarget)}
        className={`relative px-3.5 py-3 transition-all cursor-pointer h-full flex flex-col justify-center gap-1.5 rounded-lg border ${
          isOnBye
            ? 'opacity-50 grayscale border-transparent hover:opacity-80'
            : isMutedBench
              ? 'opacity-75 border-transparent hover:opacity-100'
              : isCardDominant
                ? player.is_user_team
                  ? 'bg-gradient-to-r from-amber-950/40 to-zinc-900/20 border-amber-300/30 shadow-[0_0_18px_rgba(226,185,100,0.14)] hover:border-amber-300/50'
                  : 'bg-gradient-to-l from-sky-950/45 to-slate-900/20 border-sky-300/30 shadow-[0_0_18px_rgba(125,211,252,0.14)] hover:border-sky-300/50'
                : 'border-transparent hover:bg-white/[0.025]'
        }`}
      >
        <div className={`relative z-[1] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 min-w-0 ${isRightSide ? 'lg:flex-row-reverse' : ''}`}>
          {/* Player Identity & Venue */}
          <div className={`flex items-center gap-2.5 min-w-0 flex-1 ${isRightSide ? 'lg:flex-row-reverse lg:text-right' : ''}`}>
            <PlayerHeadshot
              player={{ id: player.player_id, name: player.player_name, team: player.nfl_team || player.team, position: player.position }}
              size="matchup"
              className={
                isCardDominant
                  ? player.is_user_team
                    ? 'ring-1 ring-amber-300/60 shadow-[0_0_10px_rgba(245,214,142,0.3)]'
                    : 'ring-1 ring-sky-300/60 shadow-[0_0_10px_rgba(125,211,252,0.3)]'
                  : ''
              }
            />
            <div data-testid="matchup-card-text-col" className={`min-w-0 flex-1 ${isRightSide ? 'lg:text-right' : ''}`}>
              <div className={`flex flex-wrap items-center gap-1.5 min-w-0 ${isRightSide ? 'lg:justify-end' : ''}`}>
                <span
                  title={player.player_name}
                  className="font-sans font-medium text-sm text-zinc-100 break-words"
                >
                  {player.player_name}
                </span>
                <PositionalBadge
                  position={player.position}
                  size="sm"
                  className="shrink-0"
                  depth={player.depth_chart_order ?? cp.depth_chart_order}
                />
                {isOnBye && (
                  <span
                    title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : `On bye in Week ${selectedWeek} - 0.0 projected points`}
                    className="text-[10px] font-mono font-medium uppercase px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/30 shrink-0"
                  >
                    {`BYE WK ${cp.bye_week || selectedWeek}`}
                  </span>
                )}
              </div>
              <div
                data-testid="matchup-venue-row"
                className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-sans text-zinc-400 mt-0.5 min-w-0 ${
                  isRightSide ? 'lg:justify-end' : ''
                }`}
              >
                <span className="font-mono tabular-nums text-zinc-300">
                  <TeamLogo team={playerTeamCode} className="mr-1" />
                  {playerTeamCode}
                  {showUpcomingBye ? ` · Bye ${playerByeWeek}` : ''} ·
                </span>
                <span className="inline-flex items-center gap-1.5 max-w-full">
                  <span data-testid="matchup-kickoff-line" className="truncate max-w-full" title={kickoffDisplay}>
                    {kickoffDisplay}
                  </span>
                  <span aria-hidden="true">·</span>
                </span>
                <span data-testid="matchup-venue-line" className="truncate max-w-full" title={stadiumDisplay}>
                  {stadiumDisplay}
                </span>
              </div>
            </div>
          </div>

          {/* Tabular Metrics: Base, Modifier & Projected */}
          <div
            data-testid="player-oracle-tree"
            role="group"
            aria-label={`Metrics for ${player.player_name}`}
            className={`shrink-0 self-end sm:self-auto flex items-center gap-3 sm:gap-3.5 font-mono tabular-nums ${isRightSide ? 'lg:flex-row-reverse' : ''}`}
          >
            <div
              data-testid="stats-node"
              className="text-right"
              title={placeholder.hasPlaceholder ? placeholder.statsTooltipText : 'Next-game baseline projected points'}
            >
              <span className="text-[10px] font-sans text-zinc-400 block leading-tight">Base</span>
              <span className="text-xs text-zinc-200 leading-tight inline-flex items-center justify-end">
                {stats.toFixed(1)}
                {placeholder.hasPlaceholder && (
                  <span className="relative z-10 inline-flex">
                    <OraclePlaceholderMarker placeholder={placeholder} kind="stats" />
                  </span>
                )}
              </span>
            </div>
            <div
              data-testid="modifier-node"
              className="text-right"
              title="Points added or subtracted by active predictors"
            >
              <span className="text-[10px] font-sans text-zinc-400 block leading-tight">Modifier</span>
              <span className={`text-xs font-semibold leading-tight inline-flex items-center justify-end ${modColor}`}>
                {formatSignedModifier(modPts)}
              </span>
            </div>
            <div
              data-testid="oracle-node"
              title={
                isCardDominant
                  ? `Slot leader: ${netPts.toFixed(2)} pts (Base ${stats.toFixed(1)} ${formatSignedModifier(modPts)})`
                  : `Projected points (Base ${stats.toFixed(1)} ${formatSignedModifier(modPts)})`
              }
              className={`relative min-w-[50px] text-right transition-colors ${
                isCardDominant
                  ? player.is_user_team
                    ? 'px-2 py-0.5 rounded-md border bg-amber-500/[0.12] border-amber-300/35'
                    : 'px-2 py-0.5 rounded-md border bg-sky-500/[0.12] border-sky-300/35'
                  : ''
              }`}
            >
              {isCardDominant && (
                <PowerupStars
                  seedKey={`${selectedWeek}-${player.player_id}-${idx}`}
                  isUserTeam={Boolean(player.is_user_team)}
                />
              )}
              <span
                className={`text-[10px] font-sans block leading-tight relative z-[1] ${
                  isCardDominant
                    ? player.is_user_team
                      ? 'text-amber-300'
                      : 'text-sky-200'
                    : 'text-amber-200/85'
                }`}
              >
                Projected
              </span>
              <span
                className={`text-sm font-semibold leading-tight inline-flex items-center justify-end relative z-[1] ${
                  isCardDominant
                    ? player.is_user_team
                      ? 'text-amber-200'
                      : 'text-sky-100'
                    : 'text-zinc-100'
                }`}
              >
                {(isOnBye ? 0 : netPts).toFixed(1)}
                {placeholder.hasPlaceholder && (
                  <span className="relative z-10 inline-flex">
                    <OraclePlaceholderMarker placeholder={placeholder} />
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {visibleCelestialLine && (
          <div
            id={celestialNoteId}
            data-testid="matchup-celestial-line"
            className={`relative z-[1] text-[11px] font-sans text-zinc-400 leading-snug break-words ${
              isRightSide ? 'lg:text-right' : ''
            }`}
          >
            {visibleCelestialLine}
          </div>
        )}
        {cleanRationale && (
          <p id={rationaleNoteId} className="sr-only">
            {cleanRationale}
          </p>
        )}

        <button
          type="button"
          aria-label={`Inspect ${player.player_name}`}
          aria-describedby={describedByIds}
          onClick={(e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            openFavPlayer(player, compareTarget);
          }}
          className="absolute inset-0 z-0 rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/70"
        />

        {/* Inline Swap Opportunity on User Starter Slots */}
        {swap && (() => {
          const benchCp = swap.playerIn;
          const evalOpts = {
            currentWeek: selectedWeek,
            enabledSystems: activeSystems,
            unitByTeam,
          };
          const benchNet = currentWeekOracleScore(benchCp, undefined, evalOpts);
          const benchDisplay = benchNet.toFixed(1);
          const currentDisplay = currentWeekOracleScore(swap.playerOut ?? cp, undefined, evalOpts).toFixed(1);
          const calculatedGain = Math.round((Number(benchDisplay) - Number(currentDisplay)) * 10) / 10;
          if (calculatedGain < 0.5) return null;
          const gainDisplay = calculatedGain.toFixed(1);
          return (
            <div
              role="button"
              tabIndex={0}
              data-testid="matchup-swap-opportunity"
              title={`Bench ${swap.playerIn.name} projects +${gainDisplay} pts higher (${benchDisplay} vs ${currentDisplay} net pts)`}
              onClick={(e: { stopPropagation: () => void }) => {
                e.stopPropagation();
                setInspected({ player: benchCp, vs: swap.playerOut ?? null });
              }}
              onKeyDown={(e: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setInspected({ player: benchCp, vs: swap.playerOut ?? null });
                }
              }}
              className="relative z-[2] mt-1 px-2.5 py-1 rounded bg-amber-500/[0.07] border border-amber-400/25 text-[11px] font-sans text-zinc-200 flex items-center justify-between gap-2 min-w-0"
            >
              <span data-testid="matchup-swap-tooltip" className="flex items-center gap-1.5 min-w-0 tabular-nums">
                <ArrowUpDown className="w-3 h-3 text-amber-300 shrink-0" />
                <span className="break-words">
                  Start <strong className="font-semibold text-zinc-100">{swap.playerIn.name}</strong> (+{gainDisplay} pts)
                </span>
              </span>
              <span className="text-amber-300 hover:underline text-[11px] font-medium shrink-0">Compare →</span>
            </div>
          );
        })()}
        {isCardDominant && (
          <LeaderStarryAura
            seedKey={`card-${selectedWeek}-${player.player_id}-${idx}`}
            isUserTeam={Boolean(player.is_user_team)}
            count={10}
          />
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col gap-5 w-full max-w-5xl mx-auto ${className}`}>
      {!embedded && showDetails && (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/[0.08] pb-4">
          <div className="space-y-1">
            <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
              Week {selectedWeek} Matchup
            </h2>
            <p className="text-xs font-sans text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-zinc-300">{currentWeekInfo.date_range}</span>
              <span aria-hidden="true">·</span>
              <span>{kickoffSky.label}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-sky-200/90">
                <Moon className="w-3 h-3 text-sky-300 shrink-0" aria-hidden="true" />
                <span>{kickoffSky.moon}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-amber-200/90">
                <Sparkles className="w-3 h-3 text-amber-300 shrink-0" aria-hidden="true" />
                <span>{kickoffSky.hour}</span>
              </span>
            </p>
          </div>
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
            {currentWeekInfo.status}
          </span>
        </div>
      )}

      {showDetails && matchupWeeks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pb-2 border-b border-white/[0.06]">
          {matchupWeeks.map((w) => {
            const isSelected = selectedWeek === w.week;
            return (
              <button
                key={w.week}
                type="button"
                data-testid={`matchup-week-btn-${w.week}`}
                onClick={() => setSelectedWeek(w.week)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-mono tabular-nums transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? 'bg-zinc-800 text-zinc-100 border border-white/15 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 border border-transparent font-medium'
                }`}
              >
                <span>Week {w.week}</span>
                {w.status === 'active' && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Scoreboard */}
      {showComparison && (() => {
        const hasHeaderScores = hasMatchupMetrics || showFinalLabel;
        const headerUserVal = Number(showFinalLabel ? matchupData.score_user : userNetTotal);
        const headerOppVal = Number(showFinalLabel ? matchupData.score_opponent : oppNetTotal);
        const headerDelta =
          hasHeaderScores && Number.isFinite(headerUserVal) && Number.isFinite(headerOppVal)
            ? headerUserVal - headerOppVal
            : 0;
        const isUserHeaderLeader = headerDelta > 0.01;
        const isOppHeaderLeader = headerDelta < -0.01;

        return (
          <section
            aria-label="Matchup scoreboard"
            className="rounded-xl border border-white/[0.08] bg-[#16181d] p-4 sm:p-6 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4 items-center">
              {/* LEFT: YOUR TEAM */}
              <div
                data-header-leader={isUserHeaderLeader ? 'true' : undefined}
                className={`relative flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-2.5 sm:gap-3.5 min-w-0 rounded-xl px-3.5 py-3 border transition-all ${
                  isUserHeaderLeader
                    ? 'bg-gradient-to-r from-amber-950/45 to-zinc-900/20 border-amber-300/35 shadow-[0_0_22px_rgba(226,185,100,0.14)]'
                    : 'border-transparent'
                }`}
              >
                <UserAvatar
                  src={matchupData.user_team?.avatar_url || matchupData.user_team?.avatar}
                  alt={`${userTeamName} avatar`}
                  fallbackText={userTeamName}
                  size="lg"
                  isUser={true}
                  className={
                    isUserHeaderLeader
                      ? 'relative z-[1] ring-amber-300/75 shadow-[0_0_12px_rgba(245,214,142,0.35)]'
                      : 'relative z-[1]'
                  }
                  testId="user-team-avatar"
                  data-testid="user-team-avatar"
                />
                <div className="relative z-[1] min-w-[150px] sm:min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-sans font-semibold text-base sm:text-lg text-zinc-100 break-words leading-snug">{userTeamName}</span>
                  </div>
                  <div className="text-xs font-sans text-zinc-400 break-words leading-snug">
                    Mgr: {stripUserSuffix(matchupData.user_team?.owner_name, 'Manager')}
                  </div>
                </div>
                <div
                  data-testid="matchup-header-user-score"
                  className="relative z-[1] text-right ml-auto shrink-0"
                >
                  <span
                    className={`text-2xl sm:text-3xl font-mono font-semibold tabular-nums block leading-none ${
                      isUserHeaderLeader ? 'text-amber-200' : 'text-zinc-100'
                    }`}
                  >
                    {hasHeaderScores
                      ? showFinalLabel
                        ? headerUserVal.toFixed(2)
                        : userNetTotal.toFixed(1)
                      : '-'}
                  </span>{' '}
                  <span className="text-[11px] font-mono tabular-nums text-zinc-400 mt-1 block">
                    {showFinalLabel
                      ? 'Final'
                      : hasMatchupMetrics
                        ? `Base ${userProj.toFixed(1)} · ${formatSignedModifier(userModTotal)}`
                        : 'Projected'}
                  </span>
                </div>
                {isUserHeaderLeader && (
                  <LeaderStarryAura
                    seedKey={`header-user-${selectedWeek}`}
                    isUserTeam={true}
                    count={12}
                  />
                )}
              </div>

              {/* CENTER: Point Edge Summary */}
              <div className="flex flex-col items-center justify-center text-center px-2 border-y sm:border-y-0 sm:border-x border-white/[0.06] py-3 sm:py-0 sm:px-5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  {showFinalLabel ? 'Final Margin' : 'Projected Edge'}
                </span>
                <span
                  className={`mt-1 text-base font-mono tabular-nums font-semibold whitespace-nowrap ${
                    !hasHeaderScores
                      ? 'text-zinc-300'
                      : headerDelta > 0.05
                        ? 'text-emerald-300'
                        : headerDelta < -0.05
                          ? 'text-rose-300'
                          : 'text-zinc-200'
                  }`}
                >
                  {hasHeaderScores
                    ? `${headerDelta >= 0 ? '+' : ''}${headerDelta.toFixed(1)} pts`
                    : '-'}
                </span>
                <span className="text-[11px] font-sans text-zinc-400 mt-0.5 break-words">
                  {!hasHeaderScores
                    ? '-'
                    : Math.abs(headerDelta) <= 0.05
                      ? 'Even Matchup'
                      : headerDelta > 0
                        ? `${userTeamName} leads`
                        : `${oppTeamName} leads`}
                </span>
              </div>

              {/* RIGHT: OPPONENT TEAM */}
              <div
                data-header-leader={isOppHeaderLeader ? 'true' : undefined}
                className={`relative flex flex-row-reverse sm:flex-row flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2.5 sm:gap-3.5 min-w-0 rounded-xl px-3.5 py-3 border transition-all ${
                  isOppHeaderLeader
                    ? 'bg-gradient-to-l from-sky-950/50 to-slate-900/20 border-sky-300/35 shadow-[0_0_22px_rgba(125,211,252,0.14)]'
                    : 'border-transparent'
                }`}
              >
                <div
                  data-testid="matchup-header-opp-score"
                  className="relative z-[1] text-right sm:text-left ml-auto sm:ml-0 sm:mr-auto shrink-0 order-3 sm:order-none"
                >
                  <span
                    className={`text-2xl sm:text-3xl font-mono font-semibold tabular-nums block leading-none ${
                      isOppHeaderLeader ? 'text-sky-200' : 'text-zinc-300'
                    }`}
                  >
                    {hasHeaderScores
                      ? showFinalLabel
                        ? headerOppVal.toFixed(2)
                        : oppNetTotal.toFixed(1)
                      : '-'}
                  </span>{' '}
                  <span className="text-[11px] font-mono tabular-nums text-zinc-400 mt-1 block">
                    {showFinalLabel
                      ? 'Final'
                      : hasMatchupMetrics
                        ? `Base ${oppProj.toFixed(1)} · ${formatSignedModifier(oppModTotal)}`
                        : 'Projected'}
                  </span>
                </div>
                <div
                  data-testid="opponent-header-card"
                  className="relative z-[1] min-w-[150px] sm:min-w-0 flex-1 sm:flex-initial sm:text-right"
                >
                  <div className="font-sans font-semibold text-base sm:text-lg text-zinc-200 break-words leading-snug">
                    {oppTeamName}
                  </div>
                  <div className="text-xs font-sans text-zinc-400 break-words leading-snug">
                    Mgr: {stripUserSuffix(matchupData.opponent_team?.owner_name, 'Manager')}
                  </div>
                </div>
                <UserAvatar
                  src={matchupData.opponent_team?.avatar_url || matchupData.opponent_team?.avatar}
                  alt={`${oppTeamName} avatar`}
                  fallbackText={oppTeamName}
                  size="lg"
                  isUser={false}
                  className={
                    isOppHeaderLeader
                      ? 'relative z-[1] ring-sky-300/75 bg-sky-950/40 shadow-[0_0_12px_rgba(125,211,252,0.35)]'
                      : 'relative z-[1] ring-sky-400/35 bg-sky-950/30'
                  }
                  testId="opponent-team-avatar"
                  data-testid="opponent-team-avatar"
                />
                {isOppHeaderLeader && (
                  <LeaderStarryAura
                    seedKey={`header-opp-${selectedWeek}`}
                    isUserTeam={false}
                    count={12}
                  />
                )}
              </div>
            </div>

            {/* Inline 3-Metric Point-Differential Comparison Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.06]">
              {[
                {
                  title: 'Base Total',
                  left: userProj,
                  right: oppProj,
                  barLeft: Math.max(0.1, userProj),
                  barRight: Math.max(0.1, oppProj),
                  fmt: (n: number) => (hasMatchupMetrics ? `${n.toFixed(1)} pts` : '-'),
                },
                {
                  title: 'Combined Modifier',
                  left: userModTotal,
                  right: oppModTotal,
                  barLeft: Math.max(0.2, userModTotal + 4),
                  barRight: Math.max(0.2, oppModTotal + 4),
                  fmt: (n: number) => (hasMatchupMetrics ? `${formatSignedModifier(n)} pts` : '-'),
                },
                {
                  title: 'Projected Total',
                  left: userNetTotal,
                  right: oppNetTotal,
                  barLeft: Math.max(0.1, userNetTotal),
                  barRight: Math.max(0.1, oppNetTotal),
                  fmt: (n: number) => (hasMatchupMetrics ? `${n.toFixed(1)} pts` : '-'),
                },
              ].map((m) => {
                const isUserLead = m.left > m.right + 0.005;
                const isOppLead = m.right > m.left + 0.005;
                const total = Math.max(m.barLeft + m.barRight, 0.2);
                return (
                  <div key={m.title} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between sm:flex-col sm:items-stretch gap-1">
                      <span className="text-xs font-sans text-zinc-400">{m.title}</span>
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums gap-3">
                        <span className={isUserLead ? 'text-amber-300 font-semibold' : 'text-zinc-300'}>{m.fmt(m.left)}</span>
                        <span className="text-zinc-400 font-sans text-[11px]">vs</span>
                        <span className={isOppLead ? 'text-sky-200 font-semibold' : 'text-zinc-300'}>{m.fmt(m.right)}</span>
                      </div>
                    </div>
                    {hasMatchupMetrics && (
                      <div className="w-full h-1 rounded-full bg-zinc-900 overflow-hidden flex">
                        <div className="bg-amber-400/75 h-full" style={{ width: `${(m.barLeft / total) * 100}%` }} />
                        <div className="bg-sky-400/65 h-full" style={{ width: `${(m.barRight / total) * 100}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {showDetails && (
        <>
          {/* Unified Head-to-Head Lineup Container */}
          <section
            aria-label="Positional starter matchups"
            className="rounded-xl border border-white/[0.08] bg-[#16181d] overflow-visible"
          >
            <div className="px-4 py-2.5 rounded-t-xl bg-[#121418] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
              <h3
                title="Starters paired 1:1 by Sleeper league starting lineup slots."
                className="font-sans text-xs font-semibold text-zinc-200"
              >
                Starting Lineups
              </h3>
              <div className="flex flex-wrap gap-1">
                {['ALL', ...leagueEligiblePositions].map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setPositionFilter(pos)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                      positionFilter === pos
                        ? 'bg-zinc-800 text-zinc-100 border border-white/15 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            <div data-testid="positional-matchup-grid" className="divide-y divide-white/[0.06] p-1">
              {displayedPairs.map((pair, idx) => {
                const hasBoth = Boolean(pair.user && pair.opp);
                const isUserOnBye = pair.user ? byePlayerIds.has(String(pair.user.player_id)) : false;
                const isOppOnBye = pair.opp ? byePlayerIds.has(String(pair.opp.player_id)) : false;
                const uNet =
                  pair.user && !isUserOnBye
                    ? starterCardStats(pair.user) + starterCardModifier(pair.user)
                    : 0;
                const oNet =
                  pair.opp && !isOppOnBye
                    ? starterCardStats(pair.opp) + starterCardModifier(pair.opp)
                    : 0;
                const delta = hasBoth ? uNet - oNet : 0;
                const isZeroSplit = hasBoth && uNet + oNet <= 0;
                const isUserFavored = hasBoth && !isZeroSplit && !isUserOnBye && delta > 0.05;
                const isOppFavored = hasBoth && !isZeroSplit && !isOppOnBye && delta < -0.05;
                const comparisonStatus = !hasBoth
                  ? 'Open'
                  : isUserOnBye && isOppOnBye
                  ? 'Both starters on bye'
                  : isUserOnBye
                  ? 'Opponent active vs user on bye'
                  : isOppOnBye
                  ? 'User active vs opponent on bye'
                  : isUserFavored
                  ? 'User dominant'
                  : isOppFavored
                  ? 'Opponent dominant'
                  : 'Even';

                return (
                  <div key={`slot-pair-${pair.slotRole}-${idx}`} className="px-1 py-0.5">
                    <span className="sr-only">
                      {`${pair.slotLabel}: ${pair.user ? `${pair.user.player_name} ${uNet.toFixed(1)} pts` : 'Empty'} vs ${pair.opp ? `${pair.opp.player_name} ${oNet.toFixed(1)} pts` : 'Empty'} - ${comparisonStatus}`}
                    </span>
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-1 lg:gap-2 items-center">
                      <div data-slot-side="user" className="h-full flex flex-col">
                        {pair.user ? (
                          renderPlayerCard(pair.user, false, idx, pair.opp, isUserFavored)
                        ) : (
                          <div className="px-3.5 py-3 text-xs font-sans text-zinc-400 h-full flex items-center">
                            Empty starter slot
                          </div>
                        )}
                      </div>
                      <RosterSlotBadge
                        slotId={pair.slotRole}
                        slotLabel={pair.slotLabel}
                        dataTestId="matchup-slot-label"
                        size="sm"
                        className="place-self-center my-0.5 lg:my-0"
                      />
                      <div data-slot-side="opponent" className="h-full flex flex-col">
                        {pair.opp ? (
                          renderPlayerCard(pair.opp, false, idx, pair.user, isOppFavored)
                        ) : (
                          <div className="px-3.5 py-3 text-xs font-sans text-zinc-400 h-full flex items-center lg:justify-end">
                            Empty opponent slot
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Compact Players on Bye Footer (omitted once bye weeks have passed and nobody is on bye) */}
          {(playersOnBye.length > 0 ||
            (selectedWeek >= resolveActiveWeek(context.draftState) && selectedWeek <= 14)) && (
            <div
              data-testid="matchup-bye-callout"
              className="px-4 py-2.5 rounded-lg bg-[#16181d] border border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs font-sans"
            >
              <span className="text-zinc-300 font-medium">
                Week {selectedWeek} Byes
              </span>
              {playersOnBye.length === 0 ? (
                <span className="text-zinc-400">No players on bye on either roster this week.</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {playersOnBye.map((p) => (
                    <span
                      key={p.player_id}
                      title={`${p.is_user_team ? userTeamName : oppTeamName} · On bye in Week ${selectedWeek} - 0.0 pts`}
                      className={`px-2 py-0.5 rounded border text-[11px] inline-flex items-center gap-1 ${
                        p.is_user_team
                          ? 'bg-amber-500/10 border-amber-400/30 text-amber-200'
                          : 'bg-zinc-800/80 border-white/10 text-zinc-300'
                      }`}
                    >
                      <span>{p.player_name}</span>
                      <span>
                        ({p.position}
                        {(p.nfl_team || p.team) ? (
                          <>
                            {' · '}
                            <TeamLogo team={p.nfl_team || p.team} className="w-3.5 h-3.5 mr-0.5 align-[-2px]" />
                            {p.nfl_team || p.team}
                          </>
                        ) : null}
                        {p.is_benched ? ' · BN' : ' · START'})
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {(() => {
        const inspectedFav = inspected?.player ? favById.get(String(inspected.player.id)) : undefined;
        const latVal = inspectedFav?.stadium?.latitude ?? inspectedFav?.stadium?.coordinates?.lat;
        const lonVal = inspectedFav?.stadium?.longitude ?? inspectedFav?.stadium?.coordinates?.lon;
        const coordStr =
          typeof latVal === 'number' && typeof lonVal === 'number' && Number.isFinite(latVal) && Number.isFinite(lonVal)
            ? `${Math.abs(latVal).toFixed(2)}°${latVal >= 0 ? 'N' : 'S'}, ${Math.abs(lonVal).toFixed(2)}°${lonVal >= 0 ? 'E' : 'W'}`
            : '';
        const transitNote = inspectedFav
          ? {
              venue: [inspectedFav.stadium?.stadium_name, coordStr].filter(Boolean).join(' · '),
              sky: [inspectedFav.lunar_phase, inspectedFav.planetary_hour].filter(Boolean).join(' · '),
              rationale: (inspectedFav.astrological_rationale || inspectedFav.rationale || '')
                .replace(/^[^\p{L}\p{N}]+/u, '')
                .trim(),
            }
          : null;
        return (
          <PlayerDetailModal
            player={inspected?.player ?? null}
            compareWith={inspected?.vs ?? null}
            isOpen={inspected !== null}
            onClose={() => setInspected(null)}
            roster={context.draftState?.my_roster || []}
            activeWeek={selectedWeek}
            transitNote={transitNote}
          />
        );
      })()}
    </div>
  );
};

export default MatchupsScreen;
