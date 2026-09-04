'use client';

import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ShieldAlert, Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        // Verify via API to ensure we don't trust frontend flags
        const checkAdmin = async () => {
          try {
            const token = await user.getIdToken();
            const { getApiUrl } = await import('../../config/api');
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/api/admin/stats`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          } catch (e) {
            setIsAdmin(false);
          }
        };
        checkAdmin();
      }
    }
  }, [user, loading, router]);

  if (loading || isAdmin === null) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center space-y-6 animate-in fade-in duration-500">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">
              You must be a platform administrator to view this area. If you believe this is an error, contact support.
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {children}
    </AppShell>
  );
}
