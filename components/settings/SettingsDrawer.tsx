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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOneiromancy } from '@/context/OneiromancyContext';
import UserAvatar from '@/components/common/UserAvatar';
import { resetRateLimit } from '@/lib/sleeper';
import { X, RefreshCw, ExternalLink } from 'lucide-react';
import {
  getOrientationPermissionStatus,
  isOrientationPermissionRequired,
  requestOrientationPermission,
  type OrientationPermissionState,
} from '@/components/common/StarfieldBackground';

export interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

function getUrlLaunchUsername(): string {
  if (typeof window === 'undefined' || !window.location?.search) return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('user') || params.get('username') || '').trim();
}

function hasUrlLaunchState(): boolean {
  if (typeof window === 'undefined' || !window.location?.search) return false;
  const params = new URLSearchParams(window.location.search);
  return Boolean(
    params.get('user')?.trim() ||
      params.get('username')?.trim() ||
      params.get('draft_id')?.trim() ||
      params.get('draft')?.trim()
  );
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  className = '',
}) => {
  const {
    draftState,
    isLoading,
    setPollInterval,
    setLeagueId,
    refreshDraft,
    loadMockData,
    setMode,
    mode,
    syncError,
  } = useOneiromancy();

  const welcomeDismissedRef = useRef<boolean>(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('oneiromancy_active_username');
      if (saved && saved.trim()) return false;
      if (hasUrlLaunchState()) return false;
      if (draftState?.isLive && draftState?.settings?.sleeper_username?.trim()) return false;
      return true;
    } catch {
      return false;
    }
  });
  const isMock = mode === 'mock';
  const configuredUsername = (
    draftState?.settings?.sleeper_username ||
    getUrlLaunchUsername() ||
    ''
  ).trim();
  const hasConfiguredUsername = !isFirstLaunch && Boolean(configuredUsername);
  const currentUsername = configuredUsername;
  // Sample data has no Sleeper leagues; never present it as if it were connected.
  const availableLeagues = hasConfiguredUsername && !isMock
    ? draftState?.available_leagues || draftState?.settings?.available_leagues || []
    : [];
  const currentLeagueId = hasConfiguredUsername
    ? draftState?.settings?.league_id ||
      (availableLeagues.length > 0 ? availableLeagues[0].league_id : '')
    : '';
  const currentInterval = draftState?.settings?.poll_interval_ms ?? 5000;

  const [inputUsername, setInputUsername] = useState<string>(() =>
    isFirstLaunch ? '' : currentUsername
  );
  const [isFetchingLeagues, setIsFetchingLeagues] = useState<boolean>(false);
  const [manualLeagueId, setManualLeagueId] = useState<string>('');
  const isEditingRef = useRef<boolean>(false);
  const [tiltPermission, setTiltPermission] = useState<OrientationPermissionState>(() =>
    getOrientationPermissionStatus()
  );

  // Sync orientation permission status and listen for dynamic permission changes
  useEffect(() => {
    if (!isOpen) return;
    setTiltPermission(getOrientationPermissionStatus());

    const handlePermissionChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ state: OrientationPermissionState }>;
      if (customEvent.detail?.state) {
        setTiltPermission(customEvent.detail.state);
      }
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener(
        'oneiromancy:orientation-permission-changed',
        handlePermissionChange as EventListener
      );
      return () => {
        window.removeEventListener(
          'oneiromancy:orientation-permission-changed',
          handlePermissionChange as EventListener
        );
      };
    }
  }, [isOpen]);

  const [isRequestingOrientation, setIsRequestingOrientation] = useState<boolean>(false);
  const orientationRequestInFlightRef = useRef<boolean>(false);

  const handleRequestOrientation = async () => {
    if (orientationRequestInFlightRef.current || isRequestingOrientation) return;
    orientationRequestInFlightRef.current = true;
    setIsRequestingOrientation(true);
    try {
      const newState = await requestOrientationPermission();
      setTiltPermission(newState);
    } finally {
      orientationRequestInFlightRef.current = false;
      setIsRequestingOrientation(false);
    }
  };

  // Detect very first browser launch when no Sleeper username or URL launch state exists
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('oneiromancy_active_username')?.trim() || '';
      const urlUser = getUrlLaunchUsername();
      const draftUser = draftState?.settings?.sleeper_username?.trim() || '';
      const urlLaunched = hasUrlLaunchState();
      if (urlUser || urlLaunched) {
        setIsFirstLaunch(false);
        if (!isEditingRef.current) {
          setInputUsername(draftState?.isLive && draftUser ? draftUser : (urlUser || draftUser || saved));
        }
      } else if (saved) {
        setIsFirstLaunch(false);
        if (!isEditingRef.current) setInputUsername(saved);
      } else if (draftState?.isLive && Boolean(draftUser) && !draftState?.sync_error) {
        setIsFirstLaunch(false);
        if (!isEditingRef.current) setInputUsername(draftUser);
      } else if (!welcomeDismissedRef.current && !draftState?.sync_error) {
        setIsFirstLaunch(true);
        if (!isEditingRef.current) setInputUsername('');
      }
    } catch {
      // Ignore localStorage access failures
    }
  }, [draftState?.isLive, draftState?.settings?.sleeper_username, draftState?.sync_error]);

  // Sync internal state when draftState updates or drawer reopens
  // Only update from draftState if the user is not actively editing and there is no active sync error
  const prevOpenForInputResetRef = useRef<boolean>(isOpen);
  useEffect(() => {
    const justOpened = !prevOpenForInputResetRef.current && isOpen;
    prevOpenForInputResetRef.current = isOpen;
    if (justOpened) {
      isEditingRef.current = false;
      let savedLocal = '';
      if (typeof window !== 'undefined') {
        try {
          savedLocal = localStorage.getItem('oneiromancy_active_username')?.trim() || '';
        } catch {
          // Ignore localStorage access failures
        }
      }
      const committedUser =
        draftState?.isLive && !draftState?.sync_error
          ? (draftState?.settings?.sleeper_username?.trim() || '')
          : '';
      const resetValue = isFirstLaunch
        ? ''
        : (getUrlLaunchUsername() || committedUser || savedLocal || '');
      setInputUsername(resetValue);
      return;
    }
    if (isEditingRef.current || isFirstLaunch) return;
    if (syncError || draftState?.sync_error) return;
    if (draftState?.settings?.sleeper_username) {
      setInputUsername(draftState.settings.sleeper_username);
    }
  }, [draftState?.isLive, draftState?.settings?.sleeper_username, syncError, draftState?.sync_error, isFirstLaunch, isOpen]);

  // Validation telemetry check
  const validatedUsername = inputUsername.trim();

  // Save handler triggered by Apply & Sync button
  const handleSave = async () => {
    const trimmedUsername = inputUsername.trim();
    if (!trimmedUsername) return;
    const wasFirstLaunch = isFirstLaunch;
    setInputUsername(trimmedUsername);
    setIsFetchingLeagues(true);
    resetRateLimit();
    try {
      const syncResult = refreshDraft
        ? await refreshDraft(trimmedUsername)
        : { ok: !draftState?.sync_error, error: draftState?.sync_error ?? null };
      if (syncResult.ok) {
        const shouldAutoClose =
          wasFirstLaunch && !welcomeDismissedRef.current;
        isEditingRef.current = false;
        welcomeDismissedRef.current = true;
        setIsFirstLaunch(false);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('oneiromancy_active_username', trimmedUsername);
          } catch {
            // Ignore localStorage access failures
          }
        }
        if (shouldAutoClose) {
          onClose();
        }
      } else if (
        wasFirstLaunch &&
        !welcomeDismissedRef.current &&
        syncResult.error !== 'Stale sync superseded'
      ) {
        setIsFirstLaunch(true);
      }
    } catch (saveErr) {
      console.warn('[SettingsDrawer] handleSave error:', saveErr);
      if (wasFirstLaunch && !welcomeDismissedRef.current) {
        setIsFirstLaunch(true);
      }
    } finally {
      setIsFetchingLeagues(false);
    }
  };

  // Immediate league switch handler
  const handleLeagueChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLeagueId = e.target.value;
    if (setLeagueId) {
      setLeagueId(newLeagueId);
    }
    if (refreshDraft) {
      await refreshDraft(undefined, newLeagueId);
    }
  };

  // Instant reset to canonical mock oneiromancy draft
  const handleLoadMockData = () => {
    if (loadMockData) {
      loadMockData();
    }
    // The sample league never fills in a username; keep the owner's real one.
    let saved = '';
    try {
      saved = localStorage.getItem('oneiromancy_active_username')?.trim() || '';
    } catch {
      // Ignore localStorage access failures
    }
    setInputUsername(getUrlLaunchUsername() || saved);
    isEditingRef.current = false;
    welcomeDismissedRef.current = true;
    setIsFirstLaunch(false);
    onClose();
  };

  // Ensure telemetry polling interval is wired
  useEffect(() => {
    if (setPollInterval && currentInterval) {
      setPollInterval(currentInterval);
    }
  }, [setPollInterval, currentInterval]);

  const prevIsOpenRef = useRef<boolean>(isOpen);
  const handleDismiss = useCallback(() => {
    isEditingRef.current = false;
    welcomeDismissedRef.current = true;
    setIsFirstLaunch(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      isEditingRef.current = false;
      welcomeDismissedRef.current = true;
      setIsFirstLaunch(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // Keyboard Escape key dismissal listener
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [isOpen, handleDismiss]);

  // Body scroll lock while modal is open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Conditional render guard placed after all React hooks
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-drawer-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs"
      onClick={handleDismiss}
    >
      <div
        onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
        className={`w-full max-w-md max-h-[88vh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-[#16181d] border border-white/10 p-5 sm:p-6 shadow-2xl space-y-5 font-sans ${className}`}
      >
        {/* Drawer Header */}
        <div className="flex justify-between items-center border-b border-white/[0.08] pb-3">
          <h2
            id="settings-drawer-title"
            className="font-sans text-base font-semibold text-zinc-100"
          >
            Settings
          </h2>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close Settings"
            className="p-2 min-w-[44px] min-h-[44px] -mr-2 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* First-Launch Onboarding Prompt */}
        {isFirstLaunch && (
          <div
            id="first-launch-welcome-banner"
            data-testid="first-launch-welcome-banner"
            className="text-xs font-sans text-zinc-300 leading-relaxed"
          >
            Welcome to Oneiromancy. Enter your Sleeper username to load your leagues and rosters, or try the sample league.
          </div>
        )}

        {/* Sample-data notice */}
        {isMock && !isFirstLaunch && (
          <div
            data-testid="settings-mock-notice"
            className="text-xs text-zinc-400 font-sans leading-relaxed"
          >
            Viewing sample league data. Enter your Sleeper username to connect a live league.
          </div>
        )}

        {!isMock && hasConfiguredUsername && (draftState?.user_avatar_url || draftState?.avatar_url || draftState?.avatar) && (
          <div
            data-testid="settings-user-profile"
            className="flex items-center gap-3 pb-3 border-b border-white/[0.06] font-sans text-xs"
          >
            <UserAvatar
              src={draftState.user_avatar_url || draftState.avatar_url}
              alt={`${currentUsername} avatar`}
              fallbackText={currentUsername}
              size="md"
              isUser={true}
              testId="settings-user-avatar"
              data-testid="settings-user-avatar"
            />
            <div>
              <span className="text-[11px] text-zinc-400 block">
                Connected account
              </span>
              <span className="text-zinc-100 font-mono font-semibold text-sm">
                @{currentUsername}
              </span>
            </div>
          </div>
        )}

        {/* Sleeper Username Input */}
        <div
          data-testid="username-section"
          className="space-y-1.5 font-sans text-xs"
        >
          <div className="flex items-center justify-between">
            <label
              htmlFor="username-input"
              className="text-zinc-200 font-medium block"
            >
              Sleeper username
            </label>
            <a
              href="https://docs.sleeper.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-zinc-400 hover:text-zinc-200 underline flex items-center gap-1 transition-colors"
              title="Sleeper's public API: read-only, no login needed"
            >
              <span>API docs</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="username-input"
              type="text"
              autoFocus={isFirstLaunch}
              value={inputUsername}
              onChange={(e) => {
                isEditingRef.current = true;
                setInputUsername(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="e.g. OneiroVanguard"
              className="flex-1 px-3 py-2.5 rounded-lg bg-[#0f1012] border border-white/15 text-zinc-100 text-xs font-mono placeholder-zinc-500 focus:outline-none focus:border-amber-400/70 transition-colors"
              aria-label="Sleeper Username"
            />
          </div>
          <span className="text-[11px] text-zinc-400 block leading-relaxed">
            Read-only sync via Sleeper&apos;s public API (<a href="https://docs.sleeper.com/" target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline hover:text-zinc-100">docs.sleeper.com</a>).
          </span>
          {/* Sync Error Banner */}
          {(syncError || draftState?.sync_error) && (
            <div
              id="sync-error-banner"
              className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/35 text-rose-200 text-xs font-sans space-y-0.5"
            >
              <div className="font-semibold text-rose-200">Sync error</div>
              <div className="text-[11px] font-mono text-rose-200/90 break-words leading-relaxed">
                {syncError || draftState?.sync_error}
              </div>
            </div>
          )}
          {/* Dynamic Status */}
          {!isMock && (isFetchingLeagues || isLoading || syncError || (hasConfiguredUsername && availableLeagues.length > 0)) && (
            <div
              id="username-status-badge"
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-sans flex items-center gap-1.5 ${
                isFetchingLeagues || isLoading
                  ? 'bg-zinc-900 border border-white/10 text-zinc-300'
                  : syncError
                  ? 'bg-rose-950/40 border border-rose-500/30 text-rose-200'
                  : 'bg-emerald-950/40 border border-emerald-500/25 text-emerald-300'
              }`}
            >
              {isFetchingLeagues || isLoading ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-zinc-400 shrink-0" />
                  <span>Checking Sleeper for <span className="font-mono">@{validatedUsername || currentUsername}</span></span>
                </>
              ) : syncError ? (
                <span className="break-all font-mono">{syncError}</span>
              ) : (
                <span>
                  Connected · {availableLeagues.length} league{availableLeagues.length === 1 ? '' : 's'} found
                </span>
              )}
            </div>
          )}
        </div>

        {/* Dynamic League Selector */}
        <div className="space-y-1.5 font-sans text-xs">
          <div className="flex items-center justify-between">
            <label htmlFor="league-select" className="text-zinc-200 font-medium block">
              League
            </label>
            {isLoading && (
              <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Loading</span>
              </div>
            )}
          </div>
          <select
            id="league-select"
            aria-label="League Selector"
            value={currentLeagueId}
            onChange={handleLeagueChange}
            disabled={isLoading || !hasConfiguredUsername || isMock}
            className="w-full px-3 py-2.5 rounded-lg bg-[#0f1012] border border-white/15 text-zinc-100 font-sans text-xs focus:outline-none focus:border-amber-400/70 transition-colors disabled:opacity-50"
          >
            {!hasConfiguredUsername ? (
              <option value="" disabled className="bg-zinc-900 text-zinc-400">
                Enter a Sleeper username first
              </option>
            ) : isMock ? (
              <option value="" disabled className="bg-zinc-900 text-zinc-400">
                Sample league
              </option>
            ) : availableLeagues.length === 0 ? (
              <option value="" disabled className="bg-zinc-900 text-zinc-400">
                No leagues found
              </option>
            ) : (
              availableLeagues.map((league) => (
                <option
                  key={league.league_id}
                  value={league.league_id}
                  className="bg-zinc-900 text-zinc-100"
                >
                  {league.name} · {league.season}
                </option>
              ))
            )}
          </select>
          {/* Fallback Manual League ID Input when availableLeagues is empty */}
          {!isMock && hasConfiguredUsername && availableLeagues.length === 0 && (
            <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-2">
              <p className="text-[11px] text-zinc-400">
                No public leagues listed for <span className="font-mono text-zinc-300">@{validatedUsername || currentUsername}</span>. Enter a Sleeper League ID directly:
              </p>
              <div className="flex gap-2">
                <input
                  id="manual-league-id-input"
                  type="text"
                  value={manualLeagueId}
                  onChange={(e) => setManualLeagueId(e.target.value)}
                  placeholder="e.g. 9000000000000000001"
                  className="flex-1 px-2.5 py-2 rounded-lg bg-[#0f1012] border border-white/15 text-zinc-200 text-xs font-mono focus:outline-none focus:border-amber-400/70"
                  aria-label="Manual Sleeper League ID"
                />
                <button
                  type="button"
                  id="manual-league-apply-btn"
                  disabled={isLoading}
                  aria-busy={isLoading}
                  onClick={async () => {
                    const trimmed = manualLeagueId.trim();
                    if (trimmed && setLeagueId && refreshDraft) {
                      setLeagueId(trimmed);
                      if (setMode) setMode('live');
                      await refreshDraft(validatedUsername || undefined, trimmed);
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 rounded-lg text-xs font-sans font-semibold transition-colors shrink-0 disabled:opacity-50"
                >
                  Set League
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            id="apply-sync-btn"
            onClick={handleSave}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-sans text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Apply & Sync Draft"
          >
            {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{isLoading ? 'Syncing' : 'Apply & Sync'}</span>
          </button>

          <button
            type="button"
            id="load-mock-btn"
            onClick={handleLoadMockData}
            className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 font-sans text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            aria-label="Load Mock Oneiromancy Engine"
          >
            <span>Use sample league</span>
          </button>
          {mode === 'mock' && hasConfiguredUsername && (
            <button
              type="button"
              onClick={() => {
                setMode && setMode('live');
                onClose();
              }}
              className="w-full py-2 px-4 rounded-lg border border-white/10 text-amber-300 font-sans text-xs font-medium hover:bg-white/[0.03]"
            >
              Return to @{currentUsername}
            </button>
          )}
        </div>

        {/* Preferences */}
        <div
          data-testid="celestial-tilt-section"
          className="pt-4 border-t border-white/[0.08] space-y-2 font-sans text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-200">Background parallax</span>
            <span
              data-testid="celestial-tilt-status-badge"
              className="text-[11px] font-mono text-zinc-400"
            >
              {tiltPermission !== 'unsupported' ? 'Active' : 'Static'}
            </span>
          </div>

          {tiltPermission !== 'unsupported' &&
            tiltPermission !== 'granted' &&
            isOrientationPermissionRequired() && (
              <button
                type="button"
                id="enable-orientation-tilt-btn"
                data-testid="enable-orientation-tilt-btn"
                onClick={handleRequestOrientation}
                disabled={isRequestingOrientation}
                className="w-full py-1.5 px-3 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-sans font-medium border border-white/10 transition-colors disabled:opacity-50"
                aria-label="Enable Device Orientation Permission"
              >
                {isRequestingOrientation ? 'Requesting' : 'Enable iOS Motion Access'}
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default SettingsDrawer;
