import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const usePreferences = create(
  persist<{
    theme: 'light' | 'dark' | 'system';
    collapsed: boolean;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    toggle: () => void;
  }>(
    (set) => ({
      theme: 'system',
      collapsed: false,
      setTheme: (theme) => set({ theme }),
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: 'annapurna-preferences' },
  ),
);
