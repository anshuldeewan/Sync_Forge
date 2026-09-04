import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { MessageSquare, Check, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

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
    <div className="w-80 bg-muted/5 border-l border-border p-4 h-full overflow-y-auto animate-in slide-in-from-right duration-300">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Comments 
        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-xs">{unresolvedComments.length}</span>
      </h3>
      {loading ? (
        <div className="text-sm text-gray-500 animate-pulse">Loading...</div>
      ) : unresolvedComments.length === 0 ? (
        <div className="text-sm text-gray-500">No active comments on this page.</div>
      ) : (
        <div className="space-y-4">
          {unresolvedComments.map((comment) => (
            <div 
              key={comment.id} 
              className={`p-3 rounded-lg border text-sm shadow-sm transition-all duration-200 ${
                activeCommentId === comment.id 
                  ? 'bg-accent border-primary/50 shadow-md ring-1 ring-primary/20' 
                  : 'bg-background border-border hover:border-primary/30'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                    {comment.author.displayName.charAt(0)}
                  </div>
                  {comment.author.displayName}
                </div>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{new Date(comment.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-muted-foreground mb-3 text-sm">{comment.content}</p>
              
              {role !== 'VIEWER' && (
                <div className="flex gap-2 pt-2 border-t border-border/50">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => resolveComment(comment.id)}
                    className="h-7 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-500/20"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Resolve
                  </Button>
                  {/* Delete button only if admin/owner or author... just show for all and let API reject if unauthorized */}
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => deleteComment(comment.id)}
                    className="h-7 text-xs bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
