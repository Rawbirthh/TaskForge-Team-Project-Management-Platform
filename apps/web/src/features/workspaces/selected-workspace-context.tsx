import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const SELECTED_WORKSPACE_KEY = 'taskforge:selectedWorkspaceId';

interface SelectedWorkspaceValue {
  selectedWorkspaceId: string | null;
  setSelectedWorkspaceId: (id: string | null) => void;
}

const SelectedWorkspaceContext = createContext<SelectedWorkspaceValue | null>(null);

export function SelectedWorkspaceProvider({ children }: { children: ReactNode }) {
  const [selectedWorkspaceId, setSelectedState] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(SELECTED_WORKSPACE_KEY);
    } catch {
      return null;
    }
  });

  const setSelectedWorkspaceId = useCallback((id: string | null) => {
    setSelectedState(id);
    try {
      if (id) window.localStorage.setItem(SELECTED_WORKSPACE_KEY, id);
      else window.localStorage.removeItem(SELECTED_WORKSPACE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Keep in sync across tabs.
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === SELECTED_WORKSPACE_KEY) {
        setSelectedState(event.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <SelectedWorkspaceContext.Provider value={{ selectedWorkspaceId, setSelectedWorkspaceId }}>
      {children}
    </SelectedWorkspaceContext.Provider>
  );
}

export function useSelectedWorkspace(): SelectedWorkspaceValue {
  const ctx = useContext(SelectedWorkspaceContext);
  if (!ctx) {
    throw new Error('useSelectedWorkspace must be used within SelectedWorkspaceProvider');
  }
  return ctx;
}
