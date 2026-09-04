'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { Button } from '../../../components/ui/button';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function AcceptInvite() {
  const { user, loading: authLoading } = useAuth();
  const { refreshWorkspaces, switchWorkspace } = useWorkspace();
  const params = useParams();
  const router = useRouter();
  
  const [status, setStatus] = useState('Verifying invitation...');
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Must be logged in to accept
      router.push(`/login?next=/invite/${params.token}`);
      return;
    }

    const accept = async () => {
      try {
        const token = await user.getIdToken();
        const { getApiUrl } = await import('../../../config/api');
        const apiUrl = getApiUrl();

        const res = await fetch(`${apiUrl}/api/invitations/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ token: params.token })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || 'Failed to accept invitation');
        }

        const { workspaceId } = await res.json();
        setStatus('Invitation accepted! Loading workspace...');
        setIsSuccess(true);
        
        await refreshWorkspaces();
        switchWorkspace(workspaceId);
      } catch (err: any) {
        setError(err.message);
      }
    };

    accept();
  }, [user, authLoading, params.token, router, refreshWorkspaces, switchWorkspace]);

  return (
    <AuthLayout>
      <div className="flex flex-col space-y-6 text-center sm:text-left">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Workspace Invitation</h1>
          <p className="text-sm text-muted-foreground">
            Please wait while we verify your invitation.
          </p>
        </div>

        {error ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
            <Button onClick={() => router.push('/')} className="w-full">
              Go to Dashboard
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            {isSuccess ? (
              <CheckCircle2 className="h-12 w-12 text-primary" />
            ) : (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            )}
            <p className="text-sm font-medium">{status}</p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
