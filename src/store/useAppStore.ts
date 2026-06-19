import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ViewType } from '../lib/constants';

export interface AppWindow {
  id: string; 
  view: ViewType;
  x: number;
  y: number;
  width: number | string;
  height: number | string;
  isMaximized: boolean;
  isMinimized: boolean;
  zIndex: number;
}

interface AppState {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  
  windows: AppWindow[];
  openWindow: (view: ViewType) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindow: (id: string, updates: Partial<AppWindow>) => void;
  minimizeWindow: (id: string) => void;

  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  isWindowMaximized: boolean;
  toggleWindowMaximized: () => void;
  isMissionControlActive: boolean;
  toggleMissionControl: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentView: 'dashboard',
      
      windows: [],
      isMissionControlActive: false,
      toggleMissionControl: () => set((state) => ({ isMissionControlActive: !state.isMissionControlActive })),
      
      openWindow: (view) => set((state) => {
        const existingIndex = state.windows.findIndex(w => w.id === view);
        const maxZ = state.windows.reduce((max, w) => Math.max(max, w.zIndex), 0);
        
        if (existingIndex >= 0) {
          const newWindows = [...state.windows];
          newWindows[existingIndex] = { 
            ...newWindows[existingIndex], 
            zIndex: maxZ + 1,
            isMinimized: false 
          };
          return { windows: newWindows, currentView: view };
        }
        
        let targetW = typeof window !== 'undefined' ? Math.min(1200, window.innerWidth * 0.85) : 1000;
        let targetH = typeof window !== 'undefined' ? Math.min(800, window.innerHeight * 0.85) : 800;
        let targetX = typeof window !== 'undefined' ? Math.max(0, (window.innerWidth - targetW) / 2) : 100;
        let targetY = typeof window !== 'undefined' ? Math.max(0, (window.innerHeight - targetH) / 2) : 50;

        const newWindow: AppWindow = {
          id: view,
          view: view,
          x: targetX,
          y: targetY,
          width: targetW,
          height: targetH,
          isMaximized: state.isWindowMaximized || false, // Use global setting as default
          isMinimized: false,
          zIndex: maxZ + 1
        };
        return { windows: [...state.windows, newWindow], currentView: view };
      }),
      
      closeWindow: (id) => set((state) => {
        const newWindows = state.windows.filter(w => w.id !== id);
        const activeWindows = newWindows.filter(w => !w.isMinimized);
        const topWindow = activeWindows.sort((a,b) => b.zIndex - a.zIndex)[0];
        return { 
          windows: newWindows, 
          currentView: topWindow ? topWindow.view : 'dashboard'
        };
      }),
      
      focusWindow: (id) => set((state) => {
        const maxZ = state.windows.reduce((max, w) => Math.max(max, w.zIndex), 0);
        return {
          windows: state.windows.map(w => 
            w.id === id ? { ...w, zIndex: maxZ + 1, isMinimized: false } : w
          ),
          currentView: state.windows.find(w => w.id === id)?.view || 'dashboard'
        };
      }),
      
      updateWindow: (id, updates) => set((state) => ({
        windows: state.windows.map(w => w.id === id ? { ...w, ...updates } : w)
      })),

      minimizeWindow: (id) => set((state) => {
        const newWindows = state.windows.map(w => w.id === id ? { ...w, isMinimized: true } : w);
        const activeWindows = newWindows.filter(w => !w.isMinimized);
        const topWindow = activeWindows.sort((a,b) => b.zIndex - a.zIndex)[0];
        return {
          windows: newWindows,
          currentView: topWindow ? topWindow.view : 'dashboard'
        };
      }),
      
      setCurrentView: (view) => set((state) => {
        if (view === 'dashboard') {
          return { currentView: 'dashboard' };
        } else {
          const existingIndex = state.windows.findIndex(w => w.id === view);
          const maxZ = state.windows.reduce((max, w) => Math.max(max, w.zIndex), 0);
          
          if (existingIndex >= 0) {
            const newWindows = [...state.windows];
            newWindows[existingIndex] = { ...newWindows[existingIndex], zIndex: maxZ + 1, isMinimized: false };
            return { windows: newWindows, currentView: view };
          }
          
          let targetW = typeof window !== 'undefined' ? Math.min(1200, window.innerWidth * 0.85) : 1000;
          let targetH = typeof window !== 'undefined' ? Math.min(800, window.innerHeight * 0.85) : 800;
          let targetX = typeof window !== 'undefined' ? Math.max(0, (window.innerWidth - targetW) / 2) : 100;
          let targetY = typeof window !== 'undefined' ? Math.max(0, (window.innerHeight - targetH) / 2) : 50;

          const newWindow: AppWindow = {
            id: view,
            view: view,
            x: targetX,
            y: targetY,
            width: targetW,
            height: targetH,
            isMaximized: state.isWindowMaximized || false,
            isMinimized: false,
            zIndex: maxZ + 1
          };
          return { windows: [...state.windows, newWindow], currentView: view };
        }
      }),
      
      isSidebarOpen: false,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
      isWindowMaximized: false,
      toggleWindowMaximized: () => set((state) => ({ isWindowMaximized: !state.isWindowMaximized })),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        currentView: state.currentView, 
        isSidebarOpen: state.isSidebarOpen,
        isWindowMaximized: state.isWindowMaximized,
        windows: state.windows 
      }),
    }
  )
);
