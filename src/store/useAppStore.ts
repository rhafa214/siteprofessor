import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ViewType } from '../lib/constants';

interface AppState {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentView: 'dashboard',
      setCurrentView: (view) => set({ currentView: view }),
      isSidebarOpen: false,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ currentView: state.currentView, isSidebarOpen: state.isSidebarOpen }),
    }
  )
);
