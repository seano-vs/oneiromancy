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

import React, { useState } from 'react';

/** NFL team logo from Sleeper's CDN, by team code (e.g. "DET"). */
export function teamLogoUrl(team?: string | null): string | null {
  const code = String(team ?? '').trim().toLowerCase();
  return code && !['fa', 'nfl', 'bye', 'opp', 'tbd', '-'].includes(code)
    ? `https://sleepercdn.com/images/team_logos/nfl/${code}.png`
    : null;
}

/** Player headshot from Sleeper's CDN, by Sleeper player id. */
export function headshotUrl(id?: string | number | null): string | null {
  const s = String(id ?? '').trim();
  return /^\d+$/.test(s) ? `https://sleepercdn.com/content/nfl/players/thumb/${s}.jpg` : null;
}

const SIZES = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  trade: 'w-9 h-9',
  row: 'w-9 h-9 sm:w-10 sm:h-10',
  roster: 'w-9 h-9',
  matchup: 'w-9 h-9 sm:w-10 sm:h-10',
  lg: 'w-14 h-14',
} as const;

/**
 * Round headshot. Defenses (and players whose photo fails to load) fall back
 * to their team logo, then to their initials.
 */
export const PlayerHeadshot: React.FC<{
  player: { id: string | number; name: string; team?: string | null; position?: string };
  size?: keyof typeof SIZES;
  className?: string;
}> = ({ player, size = 'sm', className = '' }) => {
  const sources = [
    player.position === 'DEF' ? null : headshotUrl(player.id),
    teamLogoUrl(player.team),
  ].filter((u): u is string => Boolean(u));
  const [index, setIndex] = useState(0);
  const src = sources[index];
  const box = `${SIZES[size]} shrink-0 rounded-full bg-zinc-800 border border-white/10 overflow-hidden`;

  if (!src) {
    const initials = player.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const initialsSize =
      size === 'lg'
        ? 'text-sm font-semibold'
        : size === 'matchup' || size === 'roster' || size === 'row' || size === 'trade'
          ? 'text-xs font-medium'
          : 'text-[10px]';
    return (
      <span aria-hidden="true" className={`${box} flex items-center justify-center ${initialsSize} font-mono text-zinc-400 ${className}`}>
        {initials}
      </span>
    );
  }
  const isLogo = src === teamLogoUrl(player.team);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setIndex((i) => i + 1)}
      className={`${box} ${isLogo ? 'object-contain p-0.5' : 'object-cover'} ${className}`}
    />
  );
};

/** Small inline team logo; renders nothing if the team has none. */
export const TeamLogo: React.FC<{ team?: string | null; className?: string }> = ({ team, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const src = teamLogoUrl(team);
  if (!src || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailed(true)}
      className={`inline-block w-4 h-4 object-contain align-[-3px] ${className}`}
    />
  );
};

export default PlayerHeadshot;
