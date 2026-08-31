'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useWorkspace } from '../../../context/WorkspaceContext';

export default function AcceptInvite() {
  const { user, loading: authLoading } = useAuth();
  const { refreshWorkspaces, switchWorkspace } = useWorkspace();
  const params = useParams();
  const router = useRouter();
  
  const [status, setStatus] = useState('Verifying invitation...');
  const [error, setError] = useState('');

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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
        
        await refreshWorkspaces();
        switchWorkspace(workspaceId);
      } catch (err: any) {
        setError(err.message);
      }
    };

    accept();
  }, [user, authLoading, params.token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-900 p-6">
        <div className="max-w-md w-full bg-white dark:bg-black p-8 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Invitation Failed</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{error}</p>
          <button onClick={() => router.push('/')} className="bg-blue-600 text-white px-4 py-2 rounded">Go to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-900 p-6">
      <div className="text-lg font-medium animate-pulse">{status}</div>
    </div>
  );
}
