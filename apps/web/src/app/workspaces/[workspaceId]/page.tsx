'use client';

import * as React from 'react';
import { use } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { WorkspaceDashboard } from '../../../components/workspace/WorkspaceDashboard';
import { useAuth } from '../../../context/AuthContext';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { useRouter } from 'next/navigation';

export default function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const resolvedParams = use(params);
  const workspaceId = resolvedParams.workspaceId;
  const { user, loading: authLoading } = useAuth();
  const { activeWorkspace, switchWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Ensure the active workspace matches the URL
  React.useEffect(() => {
    if (user && !wsLoading) {
      if (!activeWorkspace || activeWorkspace.id !== workspaceId) {
        // Trigger hydration for the correct workspace
        switchWorkspace(workspaceId);
      }
    }
  }, [user, wsLoading, activeWorkspace, workspaceId, switchWorkspace]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Loading Workspace...</p>
      </div>
    );
  }

  return (
    <AppShell>
      <WorkspaceDashboard workspaceId={workspaceId} />
    </AppShell>
  );
}
