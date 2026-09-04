'use client';

import * as React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useRouter } from 'next/navigation';
import { ProjectCard } from './ProjectCard';
import { PageHeader } from '../layout/PageHeader';
import { Button } from '../ui/button';
import { Plus, Settings, FolderX } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

export function WorkspaceDashboard({ workspaceId }: { workspaceId: string }) {
  const { activeWorkspace, myRole, fetchWithAuth, refreshWorkspaces, switchWorkspace, loading } = useWorkspace();
  const router = useRouter();
  
  const canDelete = myRole === 'OWNER' || myRole === 'ADMIN';

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace) return;
    if (!confirm(`Delete workspace "${activeWorkspace.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetchWithAuth(`/api/workspaces/${activeWorkspace.id}`, { method: 'DELETE' });
      if (res.ok) {
        await refreshWorkspaces();
        router.push('/dashboard');
      } else {
        const d = await res.json();
        alert(d.error?.message || 'Delete failed');
      }
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.stopPropagation();
    if (!activeWorkspace) return;
    if (!confirm(`Delete project "${projectName}"?`)) return;
    try {
      const res = await fetchWithAuth(`/api/workspaces/${activeWorkspace.id}/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        switchWorkspace(activeWorkspace.id); // Reloads active workspace with fresh projects
      } else {
        const d = await res.json();
        alert(d.error?.message || 'Delete failed');
      }
    } catch (err) {
      alert('Delete failed');
    }
  };

  if (loading || !activeWorkspace || activeWorkspace.id !== workspaceId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
           <div className="space-y-2">
             <Skeleton className="h-8 w-64" />
             <Skeleton className="h-4 w-32" />
           </div>
           <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  const memberCount = activeWorkspace.members?.length || 0;
  const projects = activeWorkspace.projects || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={activeWorkspace.name}
        description={`${memberCount} member${memberCount !== 1 ? 's' : ''} • Your role: ${myRole || 'Member'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push(`/workspaces/${activeWorkspace.id}/settings`)}>
              <Settings className="mr-2 h-4 w-4" />
              Settings & Members
            </Button>
            <Button onClick={() => router.push(`/workspaces/${activeWorkspace.id}/projects/new`)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
            {canDelete && (
               <Button variant="destructive" onClick={handleDeleteWorkspace}>
                 Delete Workspace
               </Button>
            )}
          </div>
        }
      />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Projects</h2>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project: any) => (
               <ProjectCard 
                 key={project.id} 
                 project={project} 
                 workspaceId={activeWorkspace.id} 
                 canDelete={canDelete} 
                 onDelete={(e) => handleDeleteProject(e, project.id, project.name)} 
               />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center bg-muted/20">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FolderX className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              Get started by creating your first project in this workspace.
            </p>
            <Button onClick={() => router.push(`/workspaces/${activeWorkspace.id}/projects/new`)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
