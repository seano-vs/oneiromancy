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

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import ChaosDial from '@/components/screens/ChaosDial';
import { POINT_DIFF_STUDY_SUMMARY } from '@/lib/oracle';

export interface OraclePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Predictive Systems & Empirical Point-Differential Drawer.
 * Inspects and toggles the 25 pure esoteric predictive systems (194 conditions)
 * calibrated on 36,163 Sleeper NFL player-games (2018-2026).
 */
export const OraclePanel: React.FC<OraclePanelProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Predictive systems"
        className="h-full w-full max-w-lg overflow-y-auto bg-[#14161a] border-l border-white/10 p-5 sm:p-6 space-y-5 font-sans"
        onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="font-sans text-xl font-semibold tracking-tight text-zinc-100">
              Predictive Systems
            </h2>
            <p className="text-xs font-sans text-zinc-400 mt-1 leading-relaxed">
              Checked against{' '}
              <span className="font-mono tabular-nums text-zinc-300">
                {POINT_DIFF_STUDY_SUMMARY.totalPlayerGames.toLocaleString()}
              </span>{' '}
              real NFL performances on Sleeper ({POINT_DIFF_STUDY_SUMMARY.seasonRange}).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Predictors"
            className="p-2 min-w-[44px] min-h-[44px] -mr-2 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Three canonical point metrics */}
        <dl className="grid grid-cols-3 divide-x divide-white/[0.08] border-b border-white/[0.08] pb-4 text-xs font-sans">
          <div className="pr-3">
            <dt className="font-sans font-semibold text-zinc-100">Base</dt>
            <dd className="text-zinc-400 text-[11px] mt-0.5 leading-snug">
              Sleeper&apos;s standard projection for the next game.
            </dd>
          </div>
          <div className="px-3">
            <dt className="font-sans font-semibold text-zinc-100">Overall Modifier</dt>
            <dd className="text-zinc-400 text-[11px] mt-0.5 leading-snug">
              Points added or subtracted by active predictors.
            </dd>
          </div>
          <div className="pl-3">
            <dt className="font-sans font-semibold text-amber-200">Projected</dt>
            <dd className="text-zinc-400 text-[11px] mt-0.5 leading-snug">
              Final projection (Base + Modifier).
            </dd>
          </div>
        </dl>

        <section aria-label="Predictive system directory">
          <ChaosDial embedded />
        </section>
      </div>
    </div>
  );
};

export default OraclePanel;
