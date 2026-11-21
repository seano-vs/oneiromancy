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
import AscensionNode from './AscensionNode';
import { CosmicPlayer, IdealDraftPick } from '@/types/oneiromancy';
import { Trophy } from 'lucide-react';

export interface AscensionTimelineProps {
  steps?: IdealDraftPick[];
  currentRound?: number;
  cosmicBoard?: CosmicPlayer[];
  onSelectStep?: (step: IdealDraftPick) => void;
  onInspectPlayerById?: (playerId: string) => void;
  className?: string;
}

export const AscensionTimeline: React.FC<AscensionTimelineProps> = ({
  steps = [],
  currentRound = 5,
  cosmicBoard = [],
  onSelectStep,
  onInspectPlayerById,
  className = '',
}) => {
  if (steps.length === 0) {
    return (
      <GlassCard variant="panel" className="p-6 text-center text-zinc-400 font-mono text-xs">
        No ascension draft path calculated yet.
      </GlassCard>
    );
  }

  const allCompleted = steps.every((s) => s.is_ascended || s.round < currentRound);

  return (
    <GlassCard variant="panel" className={`p-4 sm:p-6 space-y-4 ${className}`}>
      {/* Title Header */}
      <div className="flex justify-between items-center border-b border-white/[0.08] pb-3">
        <div>
          <div className="text-sm font-sans font-semibold text-zinc-100">
            Draft Path
          </div>
          <p className="text-xs font-sans text-zinc-400">
            15-round trajectory &amp; target milestones
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-zinc-200 bg-zinc-900 border border-white/10 px-2.5 py-0.5 rounded-md">
          Round {currentRound} of 15
        </span>
      </div>

      {/* Roster Complete Banner if all rounds completed */}
      {allCompleted && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 flex items-center gap-3">
          <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="font-sans text-xs">
            <span className="font-semibold block text-emerald-200">Draft complete</span>
            <span className="text-xs text-zinc-300">
              All 15 draft rounds complete. Open Players to check waiver upgrades and trades.
            </span>
          </div>
        </div>
      )}

      {/* Timeline List with Connecting Vertical Rail */}
      <div className="relative pl-0 sm:pl-2 space-y-4 pt-1">
        {/* Continuous Connecting Rail Line */}
        <div
          className="absolute left-[15px] sm:left-[23px] top-4 bottom-4 w-px bg-white/15"
          aria-hidden="true"
        />

        {steps.map((step) => {
          const isCompleted = step.is_ascended || step.round < currentRound;
          const isCurrent = step.round === currentRound;
          const isTerminal = step.round === 15;

          // Check if primary target player is poached by opponent
          let fallbackActive = false;
          let fallbackPlayerName: string | undefined = undefined;

          if (cosmicBoard.length > 0 && isCurrent) {
            const primary = cosmicBoard.find((p) => p.id === step.target_player_id);
            if (primary && primary.draft_status === 'drafted') {
              fallbackActive = true;
              const fallback = cosmicBoard.find((p) => p.id === step.fallback_player_id);
              if (fallback && fallback.draft_status === 'available') {
                fallbackPlayerName = fallback.name;
              } else {
                // Elevate best available of that position
                const bestPositional = cosmicBoard
                  .filter((p) => p.position === step.target_position && p.draft_status === 'available')
                  .sort((a, b) => b.draft_score - a.draft_score)[0];
                fallbackPlayerName = bestPositional ? bestPositional.name : step.fallback_player_name;
              }
            }
          }

          return (
            <AscensionNode
              key={`round-${step.round}-${step.overall_pick}`}
              step={step}
              isCurrent={isCurrent}
              isCompleted={isCompleted}
              isTerminal={isTerminal}
              fallbackActive={fallbackActive}
              fallbackPlayerName={fallbackPlayerName}
              onInspect={() => {
                if (onSelectStep) onSelectStep(step);
                if (onInspectPlayerById && step.target_player_id) {
                  onInspectPlayerById(step.target_player_id);
                }
              }}
            />
          );
        })}
      </div>
    </GlassCard>
  );
};

export default AscensionTimeline;
