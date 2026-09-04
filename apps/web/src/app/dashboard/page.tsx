'use client';

import * as React from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { DashboardOverview } from '../../components/dashboard/DashboardOverview';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';

export default function GlobalDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <AppShell>
      <DashboardOverview />
    </AppShell>
  );
}
