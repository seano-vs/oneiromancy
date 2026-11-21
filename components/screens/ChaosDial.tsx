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

import React, { useState } from 'react';
import GlassCard from '@/components/common/GlassCard';
import { TeamLogo } from '@/components/common/PlayerHeadshot';
import { useOptionalOneiromancy } from '@/context/OneiromancyContext';
import {
  ALL_PREDICTOR_SYSTEM_IDS,
  DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS,
  formatSignedModifier,
  getPredictiveCategoriesWithSystems,
  GITHUB_EMPIRICAL_STUDY_URL,
  modifierTextColor,
  playerForecast,
  POINT_DIFF_STUDY_SUMMARY,
  PREDICTOR_SYSTEM_META,
  resolveActiveWeek,
} from '@/lib/oracle';
import { CosmicPlayer } from '@/types/oneiromancy';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';

export interface ChaosDialProps {
  players?: CosmicPlayer[];
  className?: string;
  onResetWeights?: () => void;
  /** Inside the Predictors drawer: render compact directory and methodology. */
  embedded?: boolean;
}

export const ChaosDial: React.FC<ChaosDialProps> = ({
  players: propPlayers,
  className = '',
  onResetWeights,
  embedded = false,
}) => {
  const context = useOptionalOneiromancy();
  const enabledSystems = context?.enabledSystems ?? [...DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS];
  const players = propPlayers || context?.draftState?.cosmic_board || [];
  const activeWeek = resolveActiveWeek(context?.draftState);

  const [isMethodologyOpen, setIsMethodologyOpen] = useState<boolean>(true);
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  const categorizedGroups = getPredictiveCategoriesWithSystems();
  const isDefaultSet =
    enabledSystems.length === DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS.length &&
    DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS.every((id) => enabledSystems.includes(id));
  const isAllSystemsActive = enabledSystems.length === ALL_PREDICTOR_SYSTEM_IDS.length;
  const isNoneActive = enabledSystems.length === 0;

  const samplePlayer: CosmicPlayer | undefined =
    context?.draftState?.my_roster?.find((s) => s.player)?.player || players[0];

  const sampleForecast = samplePlayer
    ? playerForecast(samplePlayer, {
        currentWeek: activeWeek,
        enabledSystems,
        placeholder: true,
        nextGameLookahead: true,
      })
    : null;

  const handleReset = () => {
    if (onResetWeights) onResetWeights();
    if (context?.resetPredictorSystems) context.resetPredictorSystems();
  };

  const handleEnableAll = () => {
    if (context?.enableAllPredictorSystems) context.enableAllPredictorSystems();
  };

  const handleDisableAll = () => {
    if (context?.disableAllPredictorSystems) context.disableAllPredictorSystems();
  };

  return (
    <div className={`flex flex-col gap-5 w-full max-w-5xl mx-auto ${className}`}>
      {!embedded && (
        <div className="space-y-1">
          <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
            Predictive Systems
          </h2>
          <p className="text-xs text-zinc-400 font-sans">
            {POINT_DIFF_STUDY_SUMMARY.systemCount} predictors across {POINT_DIFF_STUDY_SUMMARY.categoryCount} categories ({POINT_DIFF_STUDY_SUMMARY.conditionCount} rules checked against real NFL games).
          </p>
        </div>
      )}

      {/* Live Sample Player Preview */}
      {samplePlayer && sampleForecast && (
        <GlassCard variant="panel" className="p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <span className="text-[10px] font-sans text-zinc-400 block">Preview player</span>
              <span className="font-sans text-zinc-100 font-semibold break-words block">
                {samplePlayer.name} (<TeamLogo team={samplePlayer.team} className="w-3.5 h-3.5 mr-1 align-[-2px]" />
                {samplePlayer.team})
              </span>
            </div>
            <div className="flex items-center gap-3.5 font-mono tabular-nums text-right shrink-0">
              <div>
                <span className="text-[10px] font-sans text-zinc-400 block">Base</span>
                <span className="text-xs text-zinc-200 font-medium">
                  {sampleForecast.basePts.toFixed(1)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-sans text-zinc-400 block">Modifier</span>
                <span
                  className={`text-xs font-semibold ${modifierTextColor(
                    sampleForecast.overallModifierPts,
                  )}`}
                >
                  {formatSignedModifier(sampleForecast.overallModifierPts)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-sans text-amber-200/90 block">Projected</span>
                <span className="text-xs text-amber-200 font-semibold">
                  {sampleForecast.adjustedPts.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-400">
            <span>Projected = Base + Modifier</span>
            <span className="text-amber-300 font-semibold">
              {sampleForecast.adjustedPts.toFixed(2)} pts
            </span>
          </div>
        </GlassCard>
      )}

      {/* 6-Category Pure Esoteric Predictive Systems Directory */}
      <div className="space-y-3.5 pb-5 border-b border-white/[0.08]">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="space-y-0.5">
            <span className="font-sans text-sm font-semibold text-zinc-100 block">
              Active Predictors ({enabledSystems.length} of {PREDICTOR_SYSTEM_META.length})
            </span>
            <p className="text-xs font-sans text-zinc-400 leading-snug">
              The {DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS.length} predictors that beat Sleeper&apos;s projections in 2023-2026 are on by default. Ones that fell flat start off.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleReset}
              data-testid="reset-weights-btn"
              className={`px-2.5 py-1 rounded-md border text-xs font-sans font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                isDefaultSet
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200'
              }`}
              title={`Restore the ${DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS.length} positive-edge default predictors`}
            >
              <RotateCcw className="w-3 h-3" /> Default ({DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS.length})
            </button>
            <button
              type="button"
              onClick={handleEnableAll}
              data-testid="enable-all-predictors-btn"
              className={`px-2.5 py-1 rounded-md border text-xs font-sans font-medium cursor-pointer transition-colors ${
                isAllSystemsActive
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200'
              }`}
              title={`Enable all ${PREDICTOR_SYSTEM_META.length} predictive systems`}
            >
              Enable all ({PREDICTOR_SYSTEM_META.length})
            </button>
            <button
              type="button"
              onClick={handleDisableAll}
              data-testid="disable-all-predictors-btn"
              className={`px-2.5 py-1 rounded-md border text-xs font-sans font-medium cursor-pointer transition-colors ${
                isNoneActive
                  ? 'bg-zinc-800 border-white/20 text-zinc-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
              }`}
              title="Disable all predictive systems"
            >
              Disable all
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {categorizedGroups.map((cat) => {
            const activeInCat = cat.systems.filter((s) => enabledSystems.includes(s.id)).length;
            const allCatEnabled = activeInCat === cat.systems.length;

            return (
              <div
                key={cat.id}
                data-testid={`predictor-category-${cat.id}`}
                className="rounded-lg border border-white/[0.08] bg-[#0f1012] overflow-hidden"
              >
                <div className="px-3.5 py-2.5 bg-[#15181e] border-b border-white/[0.06] flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-sans text-xs font-semibold text-zinc-100">
                        {cat.label}
                      </span>
                      <span className="font-mono tabular-nums text-[10px] text-zinc-400">
                        {activeInCat}/{cat.systems.length} active
                      </span>
                    </div>
                    <span className="text-[11px] font-sans text-zinc-400 block mt-0.5 leading-snug">
                      {cat.cosmicSource}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={allCatEnabled}
                    data-testid={`predictor-category-toggle-${cat.id}`}
                    aria-label={`Toggle ${cat.label} category`}
                    onClick={() => context?.togglePredictorCategory(cat.id)}
                    className="shrink-0 px-2 py-0.5 rounded border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-[11px] font-sans font-medium text-zinc-300 hover:text-zinc-100 cursor-pointer transition-colors"
                  >
                    {allCatEnabled ? 'Disable group' : 'Enable group'}
                  </button>
                </div>

                <div className="divide-y divide-white/[0.06]">
                  {cat.systems.map((sys) => {
                    const isEnabled = enabledSystems.includes(sys.id);
                    const isInfoOpen = activeTooltipId === sys.id;
                    const oosSpread = sys.oosQuintileSpreadPts;

                    return (
                      <div
                        key={sys.id}
                        data-testid={`predictor-row-${sys.id}`}
                        className={`px-3.5 py-2.5 space-y-1.5 font-sans text-xs transition-colors ${
                          isEnabled ? 'bg-[#0f1012]' : 'bg-[#0b0c0e]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isEnabled}
                              data-testid={`predictor-toggle-${sys.id}`}
                              aria-label={`Enable ${sys.name}`}
                              onClick={() => context?.togglePredictorSystem(sys.id)}
                              className={`mt-0.5 relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 ${
                                isEnabled
                                  ? 'bg-amber-400/85 border-amber-300/60'
                                  : 'bg-zinc-800 border-white/15'
                              }`}
                            >
                              <span
                                className={`inline-block h-2.5 w-2.5 rounded-full transition-transform ${
                                  isEnabled
                                    ? 'translate-x-3.5 bg-zinc-950'
                                    : 'translate-x-0.5 bg-zinc-400'
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => context?.togglePredictorSystem(sys.id)}
                              className="min-w-0 flex-1 text-left cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5 flex-wrap leading-snug">
                                <span
                                  className={
                                    isEnabled
                                      ? 'text-zinc-100 font-medium'
                                      : 'text-zinc-400 font-medium'
                                  }
                                >
                                  {sys.shortName}
                                </span>
                                {sys.defaultEnabled && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-400/10 border border-amber-400/25 text-[10px] font-sans font-medium text-amber-300">
                                    Default
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-zinc-400 block leading-snug">
                                {sys.subCategory} · {sys.conditionCount} rules
                              </span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              title="Average fantasy point gap between favorable and unfavorable games in 2023-2026 blind testing"
                              data-testid={`predictor-edge-${sys.id}`}
                              className={`font-mono tabular-nums text-[11px] font-medium ${modifierTextColor(
                                oosSpread,
                              )}`}
                            >
                              {formatSignedModifier(oosSpread)} pts edge
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveTooltipId(isInfoOpen ? null : sys.id)}
                              aria-label={`Explain ${sys.shortName}`}
                              data-testid={`predictor-tooltip-btn-${sys.id}`}
                              className="text-zinc-400 hover:text-zinc-200 transition-colors p-1.5 -m-1 cursor-pointer"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isInfoOpen && (
                          <div
                            data-testid={`predictor-info-${sys.id}`}
                            className="p-2.5 rounded-md bg-[#16181d] border border-white/10 text-[11px] font-sans space-y-1.5 text-zinc-300"
                          >
                            <p className="leading-relaxed">{sys.description}</p>
                            <div>
                              <a
                                href={sys.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid={`predictor-source-link-${sys.id}`}
                                className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 underline underline-offset-2 font-medium"
                              >
                                <span>{sys.sourceLabel}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                              </a>
                            </div>
                            <p className="font-mono tabular-nums text-zinc-400">
                              Past accuracy: {formatSignedModifier(oosSpread)} pts/game · Largest
                              single rule: up to {sys.maxAbsRawDeltaPts.toFixed(2)} pts
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How Scores Work & Study Link */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setIsMethodologyOpen((prev) => !prev)}
          aria-expanded={isMethodologyOpen}
          data-testid="encyclopedia-toggle"
          className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div>
            <h3 className="font-sans text-sm font-semibold text-zinc-100">
              How Scores Work
            </h3>
            <p className="text-xs font-sans text-zinc-400">
              How past NFL games turn into weekly point adjustments.
            </p>
          </div>
          <div className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 shrink-0">
            {isMethodologyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isMethodologyOpen && (
          <div className="space-y-3 font-sans text-xs text-zinc-400 pt-1">
            <div className="p-3 rounded-lg bg-[#0f1012] border border-white/[0.08] space-y-1.5">
              <div className="font-mono text-zinc-200 font-medium text-[11px]">
                Actual Points Minus Sleeper Projection
              </div>
              <p className="text-[11px] leading-relaxed">
                We compared what NFL players scored against what Sleeper projected across{' '}
                {POINT_DIFF_STUDY_SUMMARY.totalPlayerGames.toLocaleString()} appearances (
                {POINT_DIFF_STUDY_SUMMARY.uniqueNflGames.toLocaleString()} games,{' '}
                {POINT_DIFF_STUDY_SUMMARY.seasonRange}). Quarterbacks, running backs, receivers,
                tight ends, kickers, and defenses are scored separately so big QB swings aren&apos;t
                watered down by kickers, keeping an average game at 0.00 pts.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-[11px] border-t border-white/[0.06] pt-3 font-mono tabular-nums">
              <div>
                <dt className="font-sans text-zinc-400">Blind Test Seasons</dt>
                <dd className="text-zinc-200 mt-0.5">
                  2023-2026 ({POINT_DIFF_STUDY_SUMMARY.testRowCount.toLocaleString()} games)
                </dd>
              </div>
              <div>
                <dt className="font-sans text-zinc-400">Scored By Position</dt>
                <dd className="text-zinc-200 mt-0.5">
                  QB, RB, WR, TE, K, DEF
                </dd>
              </div>
              <div>
                <dt className="font-sans text-zinc-400">
                  Best {POINT_DIFF_STUDY_SUMMARY.trainScreenedConditionCount} Rules
                </dt>
                <dd className="text-emerald-300 font-semibold mt-0.5">
                  +{POINT_DIFF_STUDY_SUMMARY.trainScreenedOosDecileSpreadPts.toFixed(2)} pts per game
                </dd>
              </div>
              <div>
                <dt className="font-sans text-zinc-400">All 25 Predictors</dt>
                <dd className="text-emerald-300 font-semibold mt-0.5">
                  +{POINT_DIFF_STUDY_SUMMARY.oosDecileSpreadPts.toFixed(2)} pts per game
                </dd>
              </div>
            </dl>

            <div className="pt-2 border-t border-white/[0.06] flex flex-wrap gap-4 text-xs font-sans text-zinc-400">
              <a
                href="https://docs.sleeper.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-200 underline flex items-center gap-1"
              >
                <span>Sleeper Public API</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://ssd.jpl.nasa.gov/horizons/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-200 underline flex items-center gap-1"
              >
                <span>NASA Planetary Positions</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={GITHUB_EMPIRICAL_STUDY_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="empirical-study-github-link"
                className="hover:text-zinc-200 underline flex items-center gap-1"
              >
                <span>Read the full 2018-2026 study on GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChaosDial;
