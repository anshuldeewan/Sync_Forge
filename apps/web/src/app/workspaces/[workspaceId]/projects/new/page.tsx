'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../context/AuthContext';
import { useWorkspace } from '../../../../../context/WorkspaceContext';

export default function NewProject() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { refreshWorkspaces, activeWorkspace } = useWorkspace();

  if (activeWorkspace?.id !== params.workspaceId) {
    router.push('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const token = await user?.getIdToken();
      const { getApiUrl } = await import('../../../../../config/api');
      const apiUrl = getApiUrl();

      const res = await fetch(`${apiUrl}/api/workspaces/${params.workspaceId}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to create project');
      }

      await refreshWorkspaces();
      router.push('/'); // Back to dashboard
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-900">
      <div className="w-full max-w-md bg-white dark:bg-black p-8 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800">
        <h2 className="text-2xl font-bold mb-6 text-center">Create Project</h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded bg-transparent"
              placeholder="e.g. Q3 Roadmap"
              required
            />
          </div>
          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-1/3 p-2 rounded border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-2/3 p-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
