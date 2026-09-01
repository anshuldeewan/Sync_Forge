import { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface Revision {
  id: string;
  versionNumber: number;
  message: string | null;
  size: number;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    email: string;
  };
}

interface HistoryPanelProps {
  workspaceId: string;
  projectId: string;
  resourceId: string;
  onClose: () => void;
  onRestore: (versionId: string) => void;
  onPreview: (versionId: string) => void;
  canRestore: boolean;
}

export function HistoryPanel({ workspaceId, projectId, resourceId, onClose, onRestore, onPreview, canRestore }: HistoryPanelProps) {
  const { fetchWithAuth } = useWorkspace();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadRevisions = async (pageNumber: number) => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceId}/revisions?page=${pageNumber}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        if (pageNumber === 1) {
          setRevisions(data.revisions);
        } else {
          setRevisions(prev => [...prev, ...data.revisions]);
        }
        setHasMore(data.page < data.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadRevisions(1);
  }, [resourceId]);

  return (
    <div className="w-80 border-l border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex flex-col h-full absolute right-0 top-0 z-20 shadow-lg">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Version History</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && page === 1 ? (
          <div className="text-sm text-gray-500 text-center py-4">Loading history...</div>
        ) : revisions.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">No revisions found.</div>
        ) : (
          <>
            {revisions.map((rev) => (
              <div key={rev.id} className="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-sm text-gray-800 dark:text-gray-200">Version {rev.versionNumber}</span>
                  <span className="text-xs text-gray-500" title={new Date(rev.createdAt).toLocaleString()}>
                    {new Date(rev.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  by {rev.author.displayName}
                </div>
                {rev.message && (
                  <div className="text-xs text-gray-700 dark:text-gray-300 italic bg-gray-100 dark:bg-zinc-900/50 p-2 rounded mb-3">
                    "{rev.message}"
                  </div>
                )}
                <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-zinc-700/50">
                  <button 
                    onClick={() => onPreview(rev.id)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex-1 text-center"
                  >
                    Preview / Diff
                  </button>
                  {canRestore && (
                    <button 
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to restore Version ${rev.versionNumber}? This will create a new version.`)) {
                          onRestore(rev.id);
                        }
                      }}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline flex-1 text-center"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
            {hasMore && (
              <button 
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  loadRevisions(nextPage);
                }}
                className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
