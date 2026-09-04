'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../context/AuthContext';
import { useWorkspace } from '../../../../../context/WorkspaceContext';

export default function WorkspaceAuditLogs() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const router = useRouter();
  
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    if (!user) return null;
    const token = await user.getIdToken();
    const { getApiUrl } = await import('../../../../../config/api');
    const apiUrl = getApiUrl();
    return fetch(`${apiUrl}${url}`, {
      ...options,
      headers: { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
  };

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/audit?page=${page}&limit=${limit}`);
      if (!res) return;
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to load audit logs');
      }
      
      setLogs(data.auditLogs || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && activeWorkspace) {
      if (activeWorkspace.id !== workspaceId) {
        router.push('/');
      } else {
        loadLogs();
      }
    }
  }, [user, activeWorkspace, workspaceId, router, page]);

  // Handle unauthorized view
  if (error && error.toLowerCase().includes('permission')) {
    return (
      <div className="p-8 max-w-4xl mx-auto w-full text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">You do not have permission to view audit logs for this workspace.</p>
        <button onClick={() => router.push(`/workspaces/${workspaceId}/settings`)} className="bg-blue-600 text-white px-4 py-2 rounded">
          Return to Settings
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 p-8">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push(`/workspaces/${workspaceId}/settings`)} className="text-blue-500 hover:underline">
            &larr; Back to Settings
          </button>
        </div>
        
        <h1 className="text-3xl font-bold mb-8">Workspace Audit Logs</h1>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

        <div className="bg-white dark:bg-black rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-zinc-800 border-b dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Actor</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Target Resource</th>
                  <th className="py-3 px-4 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">Loading logs...</td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">No audit logs found for this workspace.</td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                      <td className="py-3 px-4 whitespace-nowrap text-gray-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        {log.user ? (
                          <div>
                            <div className="font-medium">{log.user.displayName}</div>
                            <div className="text-xs text-gray-500">{log.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">System / Unknown</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded text-xs">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-500">
                        {log.resource}
                      </td>
                      <td className="py-3 px-4">
                        {log.metadata ? (
                          <pre className="text-xs bg-gray-50 dark:bg-zinc-900 p-2 rounded overflow-x-auto max-w-xs">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {!loading && logs.length > 0 && (
            <div className="border-t dark:border-zinc-800 p-4 flex items-center justify-between bg-gray-50 dark:bg-zinc-900/50">
              <div className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button 
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button 
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
