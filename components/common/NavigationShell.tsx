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
import UserAvatar from '@/components/common/UserAvatar';
import { DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS } from '@/lib/oracle';
import { Layers, ArrowRightLeft, Users, Trophy, Settings, User } from 'lucide-react';

export type OneiromancyTab =
  | 'oneiromancy'
  | 'matchups'
  | 'board'
  | 'dial'
  | 'marketplace'
  | 'chaos'
  | 'market'
  | 'matchup'
  | 'trades'
  | 'league';

export interface NavigationShellProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  children?: React.ReactNode;
  statusText?: string;
  statusType?: 'live' | 'syncing' | 'offline';
  onOpenSettings?: () => void;
  mode?: 'live' | 'mock';
  onModeChange?: (mode: 'live' | 'mock') => void;
  syncError?: string | null;
  syncWarning?: string | null;
  onRetrySync?: () => void;
  sleeperUsername?: string;
  leagueId?: string;
  draftId?: string;
  userAvatarUrl?: string | null;
  /** Legacy prop retained for callers; no longer displayed. */
  oracleLambda?: number;
  /** Number of active predictive systems contributing to modifiers. */
  activePredictorsCount?: number;
  onOpenOracle?: () => void;
}

interface TabItem {
  id: OneiromancyTab;
  label: string;
  /** Short label for the phone tab bar. */
  short: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Four consolidated top-level sections: Roster, Matchup, Players, League. */
const TABS: TabItem[] = [
  { id: 'oneiromancy', label: 'Roster', short: 'Roster', icon: Layers },
  { id: 'matchups', label: 'Matchup', short: 'Matchup', icon: ArrowRightLeft },
  { id: 'board', label: 'Players', short: 'Players', icon: Users },
  { id: 'league', label: 'League', short: 'League', icon: Trophy },
];

const TAB_ALIASES: Record<string, OneiromancyTab> = {
  oneiromancy: 'oneiromancy',
  dial: 'oneiromancy',
  chaos: 'oneiromancy',
  matchups: 'matchups',
  matchup: 'matchups',
  board: 'board',
  market: 'board',
  marketplace: 'board',
  trades: 'board',
  league: 'league',
};

export function isTabActive(currentTab: string | undefined, tabId: OneiromancyTab): boolean {
  const resolved = TAB_ALIASES[currentTab || 'oneiromancy'] ?? 'oneiromancy';
  return resolved === (TAB_ALIASES[tabId] ?? tabId);
}

/** Plain-language description of where λ sits. */
export function oracleLeaning(lambda: number): string {
  if (lambda < 0.15) return 'stats only';
  if (lambda < 0.5) return 'mostly stats';
  if (lambda < 0.85) return 'mostly stars';
  return 'stars only';
}

export const NavigationShell: React.FC<NavigationShellProps> = ({
  activeTab = 'oneiromancy',
  onTabChange,
  children,
  statusText = 'LIVE',
  statusType = 'live',
  onOpenSettings,
  mode = 'live',
  onModeChange,
  syncError,
  syncWarning,
  onRetrySync,
  sleeperUsername = '',
  userAvatarUrl,
  activePredictorsCount = DEFAULT_ENABLED_PREDICTOR_SYSTEM_IDS.length,
  onOpenOracle,
}) => {
  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  const statusColor =
    statusType === 'live'
      ? 'bg-emerald-400'
      : statusType === 'syncing'
      ? 'bg-amber-400'
      : 'bg-zinc-500';

  return (
    <div
      data-testid="navigation-shell-root"
      className="min-h-screen flex flex-col bg-transparent relative isolate text-zinc-100 selection:bg-amber-400/25 selection:text-amber-100"
    >
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#0f1012]/95 backdrop-blur-sm border-b border-white/[0.08]">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0 h-full">
            <h1 className="font-serif font-semibold text-base sm:text-lg tracking-tight text-zinc-100 truncate">
              Oneiromancy
            </h1>
            <span aria-hidden="true" className="hidden md:block h-4 w-px bg-white/10" />
            {/* Desktop tabs; phones use the bottom bar instead */}
            <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1 h-full">
              {TABS.map((tab) => {
                const isActive = isTabActive(activeTab, tab.id);
                return (
                  <button
                    key={`desktop-${tab.id}`}
                    type="button"
                    data-testid={`desktop-nav-tab-${tab.id}`}
                    onClick={() => handleTabClick(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative h-full px-3 text-xs font-sans transition-colors flex items-center border-b-2 ${
                      isActive
                        ? 'border-amber-400 text-zinc-100 font-semibold'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200 font-medium'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Predictors chip: opens 13-System Predictor Toggles & Empirical Study */}
            {onOpenOracle && (
              <button
                type="button"
                data-testid="oracle-chip"
                onClick={onOpenOracle}
                aria-label={`Predictive systems, ${activePredictorsCount} active`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-zinc-900 hover:bg-zinc-800 hover:border-white/20 text-zinc-200 text-xs font-sans font-medium transition-colors whitespace-nowrap"
              >
                <span>Predictors</span>
                <span className="text-zinc-500" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-amber-300">{activePredictorsCount}</span>
              </button>
            )}

            {/* Single sync indicator */}
            <div
              data-testid="draft-status-indicator"
              className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono tabular-nums whitespace-nowrap text-zinc-400"
            >
              <span className="relative flex h-1.5 w-1.5">
                {statusType === 'syncing' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${statusColor}`} />
              </span>
              <span className="hidden sm:inline">{statusText}</span>
              <span className="sm:hidden">
                {statusType === 'live' ? 'LIVE' : statusType === 'syncing' ? 'SYNC' : mode === 'mock' ? 'MOCK' : 'OFFLINE'}
              </span>
            </div>

            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Draft Settings"
              title="League & Manager Settings"
              className="relative inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg text-zinc-300 hover:text-amber-300 hover:bg-zinc-800/80 transition-colors border border-transparent hover:border-white/15 before:content-[''] before:absolute before:-inset-1.5"
            >
              <Settings
                className="w-8 h-8 shrink-0"
                strokeWidth={1.75}
                aria-hidden="true"
                data-testid="nav-settings-gear"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="w-4 h-4 rounded-full bg-[#0f1012] ring-1 ring-zinc-900 flex items-center justify-center overflow-hidden">
                  {userAvatarUrl && mode === 'live' ? (
                    <UserAvatar
                      src={userAvatarUrl}
                      alt={`${sleeperUsername || 'User'} avatar`}
                      fallbackText={sleeperUsername || 'U'}
                      size="xs"
                      isUser={false}
                      className="!w-3.5 !h-3.5 !ring-1 !ring-amber-300/60 !shadow-none"
                      testId="nav-user-avatar"
                      data-testid="nav-user-avatar"
                    />
                  ) : (
                    <User
                      className="w-3.5 h-3.5 text-zinc-200"
                      strokeWidth={2.25}
                      aria-hidden="true"
                      data-testid="nav-manager-fallback-icon"
                    />
                  )}
                </span>
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Sync problem notice */}
      {syncError && (
        <div
          role="region"
          aria-label="Sleeper sync status"
          data-testid="sleeper-sync-error-banner"
          className="bg-amber-950/60 border-b border-amber-500/30"
        >
          <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-200">
            <div className="space-y-0.5 min-w-0">
              <div className="font-semibold text-amber-200">Couldn&apos;t reach Sleeper</div>
              <div className="text-amber-200/90 font-mono text-[11px] break-all">{syncError}</div>
              {syncWarning && <div className="text-amber-300/90 text-[11px]">{syncWarning}</div>}
            </div>
            <button
              type="button"
              data-testid="retry-sync-btn"
              onClick={onRetrySync}
              className="px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-sans font-semibold shrink-0"
            >
              Retry sync
            </button>
          </div>
        </div>
      )}

      {/* Mock mode notice */}
      {mode === 'mock' && (
        <div
          role="region"
          aria-label="Sample data mode"
          data-testid="sleeper-mock-banner"
          className="bg-[#13151a] border-b border-white/[0.06]"
        >
          <div className="max-w-5xl mx-auto px-3 sm:px-6 py-1.5 flex items-center justify-between gap-2 text-xs font-sans text-zinc-400">
            <span>Sample league data</span>
            {sleeperUsername ? (
              <button
                type="button"
                onClick={() => onModeChange?.('live')}
                className="text-xs font-medium text-amber-300 hover:text-amber-200 hover:underline shrink-0"
              >
                Switch to {sleeperUsername} →
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs font-medium text-amber-300 hover:text-amber-200 hover:underline shrink-0"
              >
                Connect Sleeper →
              </button>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 pt-6 pb-24 md:pb-12">
        {children}
      </main>

      {/* Phone tab bar */}
      <nav
        role="navigation"
        aria-label="Bottom Draft Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#121418]/95 backdrop-blur-md border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-md mx-auto h-full grid grid-cols-4 items-center">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = isTabActive(activeTab, tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                data-testid={`nav-tab-${tab.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center h-full w-full gap-0.5 transition-colors ${
                  isActive ? 'text-amber-300' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {isActive && (
                  <span aria-hidden="true" className="absolute top-0 h-0.5 w-8 bg-amber-400 rounded-full transition-all" />
                )}
                <Icon className="w-4 h-4" />
                <span data-testid={`mobile-nav-tab-${tab.id}`} className="text-[11px] font-sans tracking-tight font-medium">{tab.short}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default NavigationShell;
