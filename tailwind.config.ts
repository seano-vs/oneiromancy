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

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        oneiromancy: {
          obsidian: '#0f1012',
          surface: '#16181d',
          elevated: '#1c1f26',
          brass: '#e2b964',
          gold: '#e2b964',
          green: '#34d399',
        },
        obsidian: {
          950: '#0f1012',
          900: '#16181d',
          800: '#1c1f26',
          700: '#272a33',
        },
        pos: {
          qb: '#fda4af',
          rb: '#6ee7b7',
          wr: '#7dd3fc',
          te: '#fcd34d',
          flex: '#fdba74',
          kdef: '#a1a1aa',
        },
      },
      fontFamily: {
        serif: ['var(--font-newsreader)', 'Newsreader', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
        sans: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 60s linear infinite',
        'spin-reverse': 'spin-reverse 40s linear infinite',
        'spin-inner': 'spin 20s linear infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        'powerup-star-float': 'powerup-star-float 2.2s ease-out infinite both',
      },
      keyframes: {
        'powerup-star-float': {
          '0%': { transform: 'translateY(2px) scale(0.75) rotate(-8deg)', opacity: '0' },
          '20%': { opacity: '0.95' },
          '70%': { opacity: '0.65' },
          '100%': { transform: 'translateY(-24px) scale(1.05) rotate(12deg)', opacity: '0' },
        },
        'spin-reverse': {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6', filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.4))' },
          '50%': { opacity: '1', filter: 'drop-shadow(0 0 16px rgba(6,182,212,0.8))' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
