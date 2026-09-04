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
  myRole: string | null; // Current user's role in activeWorkspace
  loading: boolean;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    const { getApiUrl } = await import('../config/api');
    const apiUrl = getApiUrl();
    
    // Only set Content-Type to JSON if it hasn't been explicitly unset (e.g. for FormData)
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      ...((options.headers as any) || {})
    };

    if (headers['Content-Type'] === undefined && !('Content-Type' in ((options.headers || {}) as any))) {
       headers['Content-Type'] = 'application/json';
    } else if (headers['Content-Type'] === 'undefined' || headers['Content-Type'] === undefined) {
       delete headers['Content-Type'];
    }

    return fetch(`${apiUrl}${url}`, {
      ...options,
      headers
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
        // Derive current user's role from the workspace members list
        // The listWorkspaces endpoint already returns members filtered to the current user
        // but getWorkspace returns all members. We find the matching member.
      } else {
        // Fallback or delete from localstorage if not found/accessible
        setActiveWorkspace(null);
        setMyRole(null);
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
      setMyRole(null);
      setLoading(false);
    }
  }, [user, authLoading]);

  // Derive myRole from the workspaces list (members filtered to current user) or from getWorkspace response
  useEffect(() => {
    if (activeWorkspace && user) {
      // getWorkspace returns all members. Find the current user's role.
      const myMembership = (activeWorkspace as any).members?.find(
        (m: any) => m.userId === user.uid
      );
      setMyRole(myMembership?.role || null);
    } else {
      setMyRole(null);
    }
  }, [activeWorkspace, user]);

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
    router.push(`/workspaces/${workspaceId}`);
  };

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, myRole, loading, switchWorkspace, refreshWorkspaces, fetchWithAuth }}>
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
