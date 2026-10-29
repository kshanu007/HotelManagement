import { create } from 'zustand';
import type { SessionUser } from '@annapurna/types';
export const useSession = create<{
  user: SessionUser | null;
  token: string | null;
  ready: boolean;
  set: (user: SessionUser | null, token: string | null) => void;
  markReady: () => void;
}>((set) => ({
  user: null,
  token: null,
  ready: false,
  set: (user, token) => set({ user, token }),
  markReady: () => set({ ready: true }),
}));
