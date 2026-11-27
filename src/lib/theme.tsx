import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { getKv, setKv } from './db';

export type ThemeMode = 'light' | 'dark';

const palettes = {
  dark: {
    background: '#1E2633',
    surface: '#2A3444',
    surfaceAlt: '#334056',
    text: '#EEF2F8',
    textMuted: '#9AA8BD',
    border: '#3C4A60',
    accent: '#7FA7E8',
    danger: '#FF7A7A',
    success: '#6FD49A',
    tabBar: 'rgba(30, 38, 51, 0.92)',
    scrim: 'rgba(0, 0, 0, 0.3)',
  },
  light: {
    background: '#F4F6FA',
    surface: '#FFFFFF',
    surfaceAlt: '#E8EDF5',
    text: '#1B2230',
    textMuted: '#5D6B80',
    border: '#D5DCE7',
    accent: '#2F5FB3',
    danger: '#C93838',
    success: '#2E8B57',
    tabBar: 'rgba(255, 255, 255, 0.94)',
    scrim: 'rgba(0, 0, 0, 0.2)',
  },
};

export type Palette = typeof palettes.dark;

type ThemeContextValue = { mode: ThemeMode; colors: Palette; setMode: (mode: ThemeMode) => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = 'theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(system === 'light' ? 'light' : 'dark');

  useEffect(() => {
    getKv(db, THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setModeState(saved);
    });
  }, [db]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      setKv(db, THEME_KEY, next);
    },
    [db],
  );

  const value = useMemo(() => ({ mode, colors: palettes[mode], setMode }), [mode, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/** A tela de login é sempre neste cinza-azulado escuro, independente do tema escolhido. */
export const loginColors = {
  background: '#232D3B',
  field: '#2E3a4C',
  fieldBorder: '#40506A',
  text: '#E8EDF5',
  muted: '#93A2B8',
  accent: '#7FA7E8',
  danger: '#FF8A8A',
  ok: '#6FD49A',
};
