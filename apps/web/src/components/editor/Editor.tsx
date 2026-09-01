'use client';

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Mention from '@tiptap/extension-mention';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { CommentMark } from './extensions/CommentMark';
import { createMentionSuggestion } from './extensions/mentionSuggestion';
import { CommentSidebar } from './CommentSidebar';

interface EditorProps {
  workspaceId: string;
  projectId: string;
  pageId: string;
}

const getRandomColor = () => {
  const colors = ['#f56565', '#ed8936', '#ecc94b', '#48bb78', '#38b2ac', '#4299e1', '#667eea', '#9f7aea', '#ed64a6'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Inner component to ensure useEditor only runs when provider is ready
function TiptapEditor({ provider, ydoc, user, role, workspaceId, fetchWithAuth, projectId, pageId }: any) {
  const isEditable = role !== 'VIEWER';
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');

  const editor = useEditor({
    editable: isEditable,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        history: false
      }),
      Collaboration.configure({
        document: ydoc
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: user?.displayName || 'Anonymous',
          color: getRandomColor()
        }
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded px-1 font-medium',
        },
        suggestion: createMentionSuggestion(workspaceId, fetchWithAuth)
      }),
      CommentMark
    ],
    onSelectionUpdate: ({ editor }) => {
      const marks = editor.getAttributes('comment');
      if (marks.commentId) {
        setActiveCommentId(marks.commentId);
      } else {
        setActiveCommentId(null);
      }
    }
  });

  const handleAddComment = async () => {
    if (!editor || !commentText.trim()) return;
    
    const commentId = crypto.randomUUID();
    
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commentId, content: commentText })
      });
      if (res.ok) {
        editor.chain().focus().setComment(commentId).run();
        setShowCommentInput(false);
        setCommentText('');
        // trigger sidebar refresh by throwing a custom event or reloading? 
        // A simple window event can notify the sidebar, or we just rely on the sidebar fetching.
        window.dispatchEvent(new Event('refresh-comments'));
      }
    } catch (e) {
      console.error('Failed to add comment', e);
    }
  };

  const handleCommentResolved = useCallback((id: string) => {
    if (!editor) return;
    // We need to unset the mark for this comment id. 
    // This is tricky without knowing the exact position, but we can rely on standard selection 
    // or just broadcast the unset if needed. For now we will let the UI handle it.
    // If the comment is resolved, we could strip the mark across the document:
    const state = editor.state;
    state.doc.descendants((node, pos) => {
      node.marks.forEach(mark => {
        if (mark.type.name === 'comment' && mark.attrs.commentId === id) {
          editor.chain().setTextSelection({ from: pos, to: pos + node.nodeSize }).unsetComment(id).run();
        }
      });
    });
  }, [editor]);

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto prose dark:prose-invert max-w-none pr-4">
        {editor && isEditable && (
          <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-lg rounded-lg flex overflow-hidden">
            {!showCommentInput ? (
              <button
                onClick={() => setShowCommentInput(true)}
                className="px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
              >
                💬 Comment
              </button>
            ) : (
              <div className="flex p-1">
                <input
                  type="text"
                  autoFocus
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Type comment..."
                  className="px-2 py-1 text-sm bg-transparent border-none focus:ring-0 outline-none w-48"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddComment();
                    if (e.key === 'Escape') setShowCommentInput(false);
                  }}
                />
                <button 
                  onClick={handleAddComment}
                  className="px-2 py-1 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 ml-1"
                >
                  Send
                </button>
              </div>
            )}
          </BubbleMenu>
        )}
        <EditorContent editor={editor} className="min-h-full cursor-text pb-20" />
      </div>
      <CommentSidebar 
        workspaceId={workspaceId}
        projectId={projectId}
        pageId={pageId}
        activeCommentId={activeCommentId}
        onCommentResolved={handleCommentResolved}
        role={role}
      />
    </div>
  );
}

import { HistoryPanel } from './HistoryPanel';

export function Editor({ workspaceId, projectId, pageId, initialShowHistory = false }: EditorProps & { initialShowHistory?: boolean }) {
  const { fetchWithAuth } = useWorkspace();
  const { user } = useAuth();
  
  const [status, setStatus] = useState('Connecting...');
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(initialShowHistory);
  const [isSavingRevision, setIsSavingRevision] = useState(false);
  
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const isReadOnly = role === 'VIEWER';

  useEffect(() => {
    let wsProvider: WebsocketProvider;
    let isMounted = true;

    async function initCollaboration() {
      try {
        const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}/token`);
        if (!res.ok) {
          if (isMounted) setStatus('Access Denied');
          return;
        }
        
        const data = await res.json();
        const { token, role, resourceId } = data;
        if (isMounted) setRole(role);

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002';

        wsProvider = new WebsocketProvider(wsUrl, `page:${pageId}`, ydocRef.current, {
          params: { token },
          connect: true
        });

        wsProvider.on('status', (event: { status: string }) => {
          if (!isMounted) return;
          if (event.status === 'connected') {
            setStatus('Connected');
          } else {
            setStatus('Offline / Reconnecting');
          }
        });
        
        wsProvider.on('connection-error', () => {
           if (isMounted) setStatus('Connection Error');
        });
        
        if (isMounted) setProvider(wsProvider);

      } catch (err) {
        console.error('Failed to init collaboration:', err);
        if (isMounted) setStatus('Error');
      }
    }

    initCollaboration();

    return () => {
      isMounted = false;
      if (wsProvider) {
        wsProvider.disconnect();
        wsProvider.destroy();
      }
    };
  }, [workspaceId, projectId, pageId]);

  const handleSaveRevision = async () => {
    if (isSavingRevision || isReadOnly) return;
    setIsSavingRevision(true);
    try {
      // Find resource ID for this page
      const resPage = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}`);
      if (resPage.ok) {
        const pageData = await resPage.json();
        const resourceId = pageData.resourceId;
        
        const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceId}/revisions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Manual save' })
        });
        if (res.ok) {
          setStatus('Revision Saved!');
          setTimeout(() => setStatus('Connected'), 2000);
        }
      }
    } catch (e) {
      console.error(e);
      setStatus('Save Failed');
    } finally {
      setIsSavingRevision(false);
    }
  };

  const [resourceIdForHistory, setResourceIdForHistory] = useState<string | null>(null);

  useEffect(() => {
    if (showHistory && !resourceIdForHistory) {
      fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}`).then(r => r.json()).then(d => {
        setResourceIdForHistory(d.resourceId);
      });
    }
  }, [showHistory]);

  const handleRestore = async (versionId: string) => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceIdForHistory}/revisions/${versionId}/restore`, {
        method: 'POST'
      });
      if (res.ok) {
        setShowHistory(false);
      } else {
        alert('Failed to restore version.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to restore version.');
    }
  };

  return (
    <div className="bg-white dark:bg-black rounded border border-gray-200 dark:border-zinc-800 p-6 flex flex-col h-[600px] relative overflow-hidden">
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-zinc-800 pb-2">
        <h2 className="text-xl font-semibold">Page Editor</h2>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${status === 'Connected' || status === 'Revision Saved!' ? 'bg-green-500' : 'bg-red-500'}`}></div>
             <span className="text-sm text-gray-500">{status}</span>
           </div>
           {!isReadOnly && (
             <button 
               onClick={handleSaveRevision}
               disabled={isSavingRevision}
               className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors disabled:opacity-50"
             >
               Save Version
             </button>
           )}
           <button 
             onClick={() => setShowHistory(!showHistory)}
             className="text-xs px-2 py-1 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
           >
             History
           </button>
        </div>
      </div>
      
      {provider ? (
        <TiptapEditor 
          provider={provider} 
          ydoc={ydocRef.current} 
          user={user} 
          role={role}
          workspaceId={workspaceId}
          projectId={projectId}
          pageId={pageId}
          fetchWithAuth={fetchWithAuth} 
        />
      ) : (
        <div className="flex-1 text-gray-500 animate-pulse">Initializing collaboration...</div>
      )}

      {showHistory && resourceIdForHistory && (
        <HistoryPanel 
          workspaceId={workspaceId}
          projectId={projectId}
          resourceId={resourceIdForHistory}
          onClose={() => setShowHistory(false)}
          onRestore={handleRestore}
          onPreview={(id) => alert('Markdown diff viewer for pages is currently unsupported in this demo.')}
          canRestore={!isReadOnly}
        />
      )}
    </div>
  );
}
