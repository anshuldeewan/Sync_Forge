'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useRouter } from 'next/navigation';

interface Workspace {
  id: string;
  name: string;
  members: any[];
  projects?: any[];
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    return fetch(`${apiUrl}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  };

  const refreshWorkspaces = async () => {
    if (!user) return;
    try {
      const res = await fetchWithAuth('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    }
  };

  const loadActiveWorkspace = async (workspaceId: string) => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveWorkspace(data.workspace);
      } else {
        // Fallback or delete from localstorage if not found/accessible
        setActiveWorkspace(null);
        localStorage.removeItem('activeWorkspaceId');
      }
    } catch (error) {
      console.error('Failed to load active workspace:', error);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    
    if (user) {
      setLoading(true);
      refreshWorkspaces().then(() => {
        const storedId = localStorage.getItem('activeWorkspaceId');
        if (storedId) {
          loadActiveWorkspace(storedId).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      });
    } else {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
    }
  }, [user, authLoading]);

  // Auto-select first workspace if none active but some exist
  useEffect(() => {
    if (!loading && !activeWorkspace && workspaces.length > 0) {
      const firstId = workspaces[0].id;
      localStorage.setItem('activeWorkspaceId', firstId);
      loadActiveWorkspace(firstId);
    }
  }, [workspaces, activeWorkspace, loading]);

  const switchWorkspace = (workspaceId: string) => {
    localStorage.setItem('activeWorkspaceId', workspaceId);
    loadActiveWorkspace(workspaceId);
    router.push('/');
  };

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, loading, switchWorkspace, refreshWorkspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
