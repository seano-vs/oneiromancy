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
import { Search, X, ArrowUpDown } from 'lucide-react';

export type BoardSortField =
  | 'oracle'
  | 'stars'
  | 'draft_score'
  | 'projected_points'
  | 'spirit_score'
  | 'market_vor'
  | 'harmony_score'
  | 'favorability_score'
  | 'adp';
export type BoardSortDirection = 'asc' | 'desc';
export type PositionFilterValue = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX';
export type BoardModeFilter = 'all' | 'waivers' | 'trades' | 'my_team';

export interface BoardControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  positionFilter: PositionFilterValue;
  onPositionFilterChange: (position: PositionFilterValue) => void;
  sortField: BoardSortField;
  sortDirection: BoardSortDirection;
  onSortChange: (field: BoardSortField, direction?: BoardSortDirection) => void;
  hideDrafted?: boolean;
  onToggleHideDrafted?: (hide: boolean) => void;
  modeFilter?: BoardModeFilter;
  onModeFilterChange?: (mode: BoardModeFilter) => void;
  positionCounts?: Record<PositionFilterValue, number>;
  totalVisibleCount?: number;
  className?: string;
}

const MODE_PILLS: Array<{ id: BoardModeFilter; label: string }> = [
  { id: 'all', label: 'All Players' },
  { id: 'waivers', label: 'Waivers' },
  { id: 'trades', label: 'Trades' },
  { id: 'my_team', label: 'My Roster' },
];

export const BoardControls: React.FC<BoardControlsProps> = ({
  searchQuery,
  onSearchChange,
  positionFilter,
  onPositionFilterChange,
  sortField,
  onSortChange,
  hideDrafted = false,
  onToggleHideDrafted,
  modeFilter = 'all',
  onModeFilterChange,
  positionCounts,
  totalVisibleCount,
  className = '',
}) => {
  const positions: PositionFilterValue[] = ['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX'];

  return (
    <div className={`space-y-2.5 w-full min-w-0 ${className}`}>
      {/* Top Toolbar: Segmented Mode Switcher + Search + Sort + Free Agents */}
      <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
        {onModeFilterChange && (
          <div
            data-testid="board-mode-pills"
            className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900 border border-white/10 overflow-x-auto scrollbar-none self-start"
          >
            {MODE_PILLS.map((pill) => {
              const active = modeFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  data-testid={`board-mode-${pill.id}`}
                  onClick={() => onModeFilterChange(pill.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-sans transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-zinc-800 text-zinc-100 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 font-medium'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center flex-1 lg:max-w-xl">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search player or team"
              aria-label="Search player or team"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-[#16181d] border border-white/10 text-xs font-sans text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear Search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex-1 min-w-0 sm:flex-none">
              <select
                value={
                  sortField === 'projected_points' || sortField === 'stars'
                    ? sortField
                    : 'oracle'
                }
                onChange={(e) => {
                  const field = e.target.value as BoardSortField;
                  onSortChange(field, 'desc');
                }}
                aria-label="Sort players by"
                className="w-full appearance-none pl-7 pr-7 py-1.5 rounded-lg bg-[#16181d] border border-white/10 text-xs font-sans text-zinc-200 focus:outline-none focus:border-amber-400/60 cursor-pointer"
              >
                <option value="oracle">Sort: Projected</option>
                <option value="projected_points">Sort: Base</option>
                <option value="stars">Sort: Modifier</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>

            {onToggleHideDrafted && modeFilter === 'all' && (
              <button
                type="button"
                onClick={() => onToggleHideDrafted(!hideDrafted)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-sans font-medium border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  hideDrafted
                    ? 'bg-zinc-800 border-amber-400/40 text-amber-200 font-semibold'
                    : 'bg-[#16181d] border-white/10 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    hideDrafted ? 'bg-amber-400' : 'bg-zinc-500'
                  }`}
                />
                <span>Free agents</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Positional Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-white/[0.06] min-w-0 max-w-full">
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          {positions.map((pos) => {
            const isActive = positionFilter === pos;
            const count = positionCounts ? positionCounts[pos] : undefined;

            return (
              <button
                key={pos}
                type="button"
                onClick={() => onPositionFilterChange(pos)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono tabular-nums transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100 border border-white/15 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 border border-transparent font-medium'
                }`}
              >
                {pos}
                {count !== undefined && <span className="ml-1 text-zinc-400 font-normal">({count})</span>}
              </button>
            );
          })}
        </div>

        {totalVisibleCount !== undefined && (
          <span className="text-xs font-mono tabular-nums text-zinc-400 whitespace-nowrap hidden sm:inline">
            {totalVisibleCount} players
          </span>
        )}
      </div>
    </div>
  );
};

export default BoardControls;
