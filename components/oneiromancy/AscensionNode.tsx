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
import { TeamLogo } from '@/components/common/PlayerHeadshot';
import PositionalBadge from '@/components/common/PositionalBadge';
import { IdealDraftPick } from '@/types/oneiromancy';
import { Check, AlertCircle } from 'lucide-react';

export interface AscensionNodeProps {
  step: IdealDraftPick;
  isCurrent: boolean;
  isCompleted: boolean;
  isTerminal: boolean;
  fallbackActive?: boolean;
  fallbackPlayerName?: string;
  onInspect?: () => void;
  className?: string;
}

export const AscensionNode: React.FC<AscensionNodeProps> = ({
  step,
  isCurrent,
  isCompleted,
  isTerminal,
  fallbackActive = false,
  fallbackPlayerName,
  onInspect,
  className = '',
}) => {
  return (
    <div className={`relative flex items-start gap-3 sm:gap-4 group ${className}`}>
      {/* Node Status Indicator */}
      <div className="relative z-10 flex items-center justify-center shrink-0 w-8 h-8 rounded-full border border-white/10 bg-[#0f1012]">
        {isCompleted ? (
          <div className="w-full h-full rounded-full bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
            <Check className="w-4 h-4" />
          </div>
        ) : isCurrent ? (
          <div className="w-full h-full rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 font-mono text-xs font-semibold">
            {step.round}
          </div>
        ) : (
          <div className="w-full h-full rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 font-mono text-xs">
            {step.round}
          </div>
        )}
      </div>

      {/* Node Content Card */}
      <div
        role={onInspect ? 'button' : undefined}
        tabIndex={onInspect ? 0 : undefined}
        onClick={onInspect}
        onKeyDown={
          onInspect
            ? (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onInspect();
                }
              }
            : undefined
        }
        className={`flex-1 p-3 rounded-lg border transition-colors ${
          onInspect ? 'cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/70' : ''
        } ${
          isCurrent
            ? 'bg-amber-500/[0.06] border-amber-400/40'
            : isCompleted
            ? 'bg-[#16181d] border-white/[0.06] opacity-75 hover:opacity-100'
            : 'bg-[#16181d] border-white/[0.08] hover:border-white/20'
        }`}
      >
        {/* Top Header: Round, Pick, Position */}
        <div className="flex justify-between items-center text-xs mb-1">
          <div className="flex items-center gap-2 font-mono tabular-nums">
            <span className="text-[11px] text-zinc-400">
              RD {String(step.round).padStart(2, '0')} · PK {String(step.overall_pick).padStart(2, '0')}
            </span>
            <PositionalBadge position={step.target_position} size="sm" />
          </div>

          {isTerminal && (
            <span className="text-[10px] font-sans font-medium text-zinc-300">
              Final round
            </span>
          )}

          {isCurrent && (
            <span className="text-[10px] font-sans font-semibold text-amber-300">
              On the clock
            </span>
          )}

          {isCompleted && (
            <span className="text-[10px] font-sans text-emerald-300 font-medium">
              Drafted
            </span>
          )}
        </div>

        {/* Player Name & Team */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="space-y-0.5">
            <span
              className={`font-sans font-medium text-sm sm:text-base ${
                isCompleted ? 'text-zinc-400 line-through' : isCurrent ? 'text-amber-200 font-semibold' : 'text-zinc-100'
              }`}
            >
              {step.target_player_name}
            </span>
            <span className="text-xs font-mono text-zinc-400 ml-2">
              <TeamLogo team={step.target_team} className="mr-1" />
              {step.target_team}
            </span>
          </div>

          <div className="text-right font-mono tabular-nums text-xs shrink-0">
            <span className="text-zinc-100 font-semibold">{(step.draft_score ?? 0).toFixed(1)} DS</span>
            <span className="text-[10px] text-zinc-400 block">
              +{((step.positional_vor ?? step.vor_normalized ?? 0)).toFixed(1)} VOR
            </span>
          </div>
        </div>

        {fallbackActive && (
          <div className="mt-2 p-2 rounded-md bg-amber-950/40 border border-amber-500/30 text-xs font-sans text-amber-200 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>
              Fallback target: <strong>{fallbackPlayerName || step.fallback_player_name}</strong>
            </span>
          </div>
        )}

        {step.elemental_synergy_tag && (
          <div className="mt-1.5 text-[11px] font-sans text-zinc-400">
            {step.elemental_synergy_tag}
          </div>
        )}

        {step.strategic_rationale && (
          <p className="mt-1 text-[11px] font-sans text-zinc-400 line-clamp-2">
            {step.strategic_rationale}
          </p>
        )}
      </div>
    </div>
  );
};

export default AscensionNode;
