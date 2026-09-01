'use client';

import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { workspaces, activeWorkspace, myRole, loading: wsLoading, switchWorkspace, fetchWithAuth, refreshWorkspaces } = useWorkspace();
  const router = useRouter();
  const canDelete = myRole === 'OWNER' || myRole === 'ADMIN';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || wsLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
      <header className="flex h-16 items-center justify-between border-b border-gray-200 dark:border-zinc-800 px-6 bg-white dark:bg-black">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">SyncForge</h1>
          
          {workspaces.length > 0 && (
            <select 
              value={activeWorkspace?.id || ''} 
              onChange={(e) => {
                if (e.target.value === 'new_workspace_action') {
                  router.push('/workspaces/new');
                } else {
                  switchWorkspace(e.target.value);
                }
              }}
              className="ml-4 rounded border-gray-300 dark:border-zinc-700 bg-transparent text-sm py-1 px-2"
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
              <option value="new_workspace_action">+ New Workspace</option>
            </select>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm">{user.displayName || user.email}</span>
          <button
            onClick={signOut}
            className="rounded bg-zinc-200 dark:bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-6">
        {!activeWorkspace ? (
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center mt-20">
            <h2 className="text-2xl font-semibold mb-2">Welcome to SyncForge</h2>
            <p className="text-gray-500 mb-8">Get started by creating your first workspace.</p>
            <button 
              onClick={() => router.push('/workspaces/new')}
              className="bg-blue-600 text-white rounded px-6 py-3 font-medium hover:bg-blue-700"
            >
              Create Workspace
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">{activeWorkspace.name} Projects</h2>
              <div className="space-x-2">
                <button 
                  onClick={() => router.push(`/workspaces/${activeWorkspace.id}/settings`)}
                  className="text-sm font-medium hover:underline text-gray-500"
                >
                  Settings &amp; Members
                </button>
                <button 
                  onClick={() => router.push(`/workspaces/${activeWorkspace.id}/projects/new`)}
                  className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700"
                >
                  New Project
                </button>
                {canDelete && (
                  <button 
                    onClick={async () => {
                      if (!confirm(`Delete workspace "${activeWorkspace.name}"? This cannot be undone.`)) return;
                      const res = await fetchWithAuth(`/api/workspaces/${activeWorkspace.id}`, { method: 'DELETE' });
                      if (res.ok) { await refreshWorkspaces(); router.push('/'); }
                      else { const d = await res.json(); alert(d.error?.message || 'Delete failed'); }
                    }}
                    className="bg-red-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-red-700"
                  >
                    Delete Workspace
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeWorkspace.projects && activeWorkspace.projects.length > 0 ? (
                activeWorkspace.projects.map((project: any) => (
                  <div 
                    key={project.id} 
                    className="border border-gray-200 dark:border-zinc-800 rounded p-4 bg-white dark:bg-black shadow-sm"
                  >
                    <div
                      onClick={() => router.push(`/workspaces/${activeWorkspace.id}/projects/${project.id}`)}
                      className="cursor-pointer hover:opacity-80"
                    >
                      <h3 className="font-medium text-lg">{project.name}</h3>
                      <p className="text-sm text-gray-500 mt-2">Created {new Date(project.createdAt).toLocaleDateString()}</p>
                    </div>
                    {canDelete && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Delete project "${project.name}"?`)) return;
                          const res = await fetchWithAuth(`/api/workspaces/${activeWorkspace.id}/projects/${project.id}`, { method: 'DELETE' });
                          if (res.ok) { await refreshWorkspaces(); }
                          else { const d = await res.json(); alert(d.error?.message || 'Delete failed'); }
                        }}
                        className="mt-3 text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Delete Project
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg text-gray-500">
                  No projects yet. Create one to get started.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
