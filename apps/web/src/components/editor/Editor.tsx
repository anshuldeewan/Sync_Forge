'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useEffect, useState, useRef } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';

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
function TiptapEditor({ provider, ydoc, user, role }: { provider: WebsocketProvider, ydoc: Y.Doc, user: any, role: string | null }) {
  const isEditable = role !== 'VIEWER';

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
      })
    ]
  });

  return <EditorContent editor={editor} className="min-h-full cursor-text" />;
}

export function Editor({ workspaceId, projectId, pageId }: EditorProps) {
  const { fetchWithAuth } = useWorkspace();
  const { user } = useAuth();
  
  const [status, setStatus] = useState('Connecting...');
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [role, setRole] = useState<string | null>(null);
  
  const ydocRef = useRef<Y.Doc>(new Y.Doc());

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
        const { token, role } = data;
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

  return (
    <div className="bg-white dark:bg-black rounded border border-gray-200 dark:border-zinc-800 p-6 flex flex-col h-[600px]">
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-zinc-800 pb-2">
        <h2 className="text-xl font-semibold">Page Editor</h2>
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
           <span className="text-sm text-gray-500">{status}</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto prose dark:prose-invert max-w-none">
        {provider ? (
          <TiptapEditor provider={provider} ydoc={ydocRef.current} user={user} role={role} />
        ) : (
          <div className="text-gray-500 animate-pulse">Initializing collaboration...</div>
        )}
      </div>
    </div>
  );
}
