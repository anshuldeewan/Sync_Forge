'use client';

import * as React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { WorkspaceCard } from './WorkspaceCard';
import { PageHeader } from '../layout/PageHeader';
import { Button } from '../ui/button';
import { Plus, LayoutDashboard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '../ui/skeleton';

export function DashboardOverview() {
  const { user } = useAuth();
  const { workspaces, loading } = useWorkspace();
  const router = useRouter();

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={`Good morning, ${displayName}`}
        description="Welcome to SyncForge. Manage your workspaces and collaborate seamlessly."
        actions={
          <Button onClick={() => router.push('/workspaces/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Workspace
          </Button>
        }
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">My Workspaces</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : workspaces.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {workspaces.map((ws) => (
              <WorkspaceCard key={ws.id} workspace={ws} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center bg-muted/20">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <LayoutDashboard className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No workspaces found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              Create your first workspace to start collaborating on projects, issues, and resources.
            </p>
            <Button onClick={() => router.push('/workspaces/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Workspace
            </Button>
          </div>
        )}
      </section>

      {/* Intentionally Omitted Sections */}
      {/* 
        Recent Projects and Recent Issues are omitted globally to avoid N+1 queries.
        The backend API only exposes projects/issues via /workspaces/:workspaceId/...
        Fake data is strictly forbidden. 
      */}
    </div>
  );
}
