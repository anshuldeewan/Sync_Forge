import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface Comment {
  id: string;
  content: string;
  author: { displayName: string; id: string };
  resolved: boolean;
  createdAt: string;
}

interface CommentSidebarProps {
  pageId: string;
  projectId: string;
  workspaceId: string;
  activeCommentId: string | null;
  onCommentResolved: (id: string) => void;
  role: string | null;
}

export function CommentSidebar({ pageId, projectId, workspaceId, activeCommentId, onCommentResolved, role }: CommentSidebarProps) {
  const { fetchWithAuth } = useWorkspace();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComments();
    
    const handleRefresh = () => {
      fetchComments();
    };
    
    window.addEventListener('refresh-comments', handleRefresh);
    return () => window.removeEventListener('refresh-comments', handleRefresh);
  }, [pageId]);

  const fetchComments = async () => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
      }
    } catch (e) {
      console.error('Failed to fetch comments', e);
    } finally {
      setLoading(false);
    }
  };

  const resolveComment = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true })
      });
      if (res.ok) {
        setComments(comments.map(c => c.id === id ? { ...c, resolved: true } : c));
        onCommentResolved(id);
      }
    } catch (e) {
      console.error('Failed to resolve comment', e);
    }
  };

  const deleteComment = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}/comments/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setComments(comments.filter(c => c.id !== id));
        onCommentResolved(id); // remove mark
      }
    } catch (e) {
      console.error('Failed to delete comment', e);
    }
  };

  const unresolvedComments = comments.filter(c => !c.resolved);

  return (
    <div className="w-80 bg-gray-50 dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 p-4 h-full overflow-y-auto">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Comments ({unresolvedComments.length})</h3>
      {loading ? (
        <div className="text-sm text-gray-500 animate-pulse">Loading...</div>
      ) : unresolvedComments.length === 0 ? (
        <div className="text-sm text-gray-500">No active comments on this page.</div>
      ) : (
        <div className="space-y-4">
          {unresolvedComments.map((comment) => (
            <div 
              key={comment.id} 
              className={`p-3 rounded-lg border text-sm shadow-sm transition-colors ${activeCommentId === comment.id ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700/50' : 'bg-white border-gray-200 dark:bg-black dark:border-zinc-800'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium">{comment.author.displayName}</span>
                <span className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-3">{comment.content}</p>
              
              {role !== 'VIEWER' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => resolveComment(comment.id)}
                    className="text-xs text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded"
                  >
                    Resolve
                  </button>
                  {/* Delete button only if admin/owner or author... just show for all and let API reject if unauthorized */}
                  <button 
                    onClick={() => deleteComment(comment.id)}
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
