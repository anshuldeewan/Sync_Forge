'use client';

import { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useRouter } from 'next/navigation';

interface Page {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface PagesListProps {
  workspaceId: string;
  projectId: string;
}

export function PagesList({ workspaceId, projectId }: PagesListProps) {
  const { fetchWithAuth } = useWorkspace();
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');

  const fetchPages = async () => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/pages`);
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages);
      } else {
        throw new Error('Failed to load pages');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, [workspaceId, projectId]);

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageTitle.trim()) return;
    
    setCreating(true);
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/pages`, {
        method: 'POST',
        body: JSON.stringify({ title: newPageTitle })
      });
      
      if (res.ok) {
        const data = await res.json();
        setNewPageTitle('');
        // Navigate to the newly created page
        router.push(`/workspaces/${workspaceId}/projects/${projectId}/pages/${data.page.id}`);
      } else {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to create page');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="text-gray-500">Loading pages...</div>;

  return (
    <div className="bg-white dark:bg-black rounded border border-gray-200 dark:border-zinc-800 p-6">
      <h2 className="text-xl font-semibold mb-6">Pages</h2>
      
      {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}
      
      <form onSubmit={handleCreatePage} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="New Page Title"
          value={newPageTitle}
          onChange={(e) => setNewPageTitle(e.target.value)}
          disabled={creating}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!newPageTitle.trim() || creating}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Page'}
        </button>
      </form>

      {pages.length === 0 ? (
        <p className="text-gray-500 italic">No pages created yet.</p>
      ) : (
        <ul className="space-y-2">
          {pages.map((page) => (
            <li key={page.id}>
              <button
                onClick={() => router.push(`/workspaces/${workspaceId}/projects/${projectId}/pages/${page.id}`)}
                className="w-full text-left p-3 border border-gray-100 dark:border-zinc-800 rounded hover:bg-gray-50 dark:hover:bg-zinc-900 flex justify-between items-center transition"
              >
                <span className="font-medium">{page.title}</span>
                <span className="text-xs text-gray-500">
                  {new Date(page.updatedAt).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
