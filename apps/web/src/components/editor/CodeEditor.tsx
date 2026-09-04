'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Editor, { useMonaco } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from './y-monaco';
import { useWorkspace } from '../../context/WorkspaceContext';
import { HistoryPanel } from './HistoryPanel';
import { DiffViewer } from './DiffViewer';
import { Button } from '../ui/button';
import { History, Save } from 'lucide-react';

interface CodeEditorProps {
  workspaceId: string;
  projectId: string;
  resourceId: string;
  filename: string;
  initialShowHistory?: boolean;
}

const getLanguage = (filename: string) => {
  if (!filename || !filename.includes('.')) return 'plaintext';
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': return 'typescript';
    case 'tsx': return 'typescript'; // Monaco treats both as typescript
    case 'js': return 'javascript';
    case 'jsx': return 'javascript';
    case 'py': return 'python';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'sql': return 'sql';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'scss': return 'scss';
    case 'java': return 'java';
    case 'cpp': return 'cpp';
    case 'c': return 'c';
    case 'cs': return 'csharp';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'yaml': case 'yml': return 'yaml';
    case 'xml': return 'xml';
    case 'sh': return 'shell';
    case 'txt': return 'plaintext';
    default: return 'plaintext';
  }
};

export function CodeEditor({ workspaceId, projectId, resourceId, filename, initialShowHistory = false }: CodeEditorProps) {
  const router = useRouter();
  const { fetchWithAuth } = useWorkspace();
  const [status, setStatus] = useState('Connecting...');
  const [role, setRole] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showHistory, setShowHistory] = useState(initialShowHistory);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [isSavingRevision, setIsSavingRevision] = useState(false);
  
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const editorRef = useRef<any>(null);

  const isReadOnly = role === 'VIEWER';

  const handleSaveRevision = async () => {
    if (isSavingRevision || isReadOnly) return;
    setIsSavingRevision(true);
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Manual save' })
      });
      if (res.ok) {
        setStatus('Revision Saved!');
        setTimeout(() => setStatus('Saved'), 2000);
      }
    } catch (e) {
      console.error(e);
      setStatus('Save Failed');
    } finally {
      setIsSavingRevision(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceId}/revisions/${versionId}/restore`, {
        method: 'POST'
      });
      if (res.ok) {
        setShowHistory(false);
        setPreviewVersionId(null);
        // The websocket server will forcefully close the connection to enforce reload,
        // which will trigger the reconnect logic in our useEffect, bringing the new state!
      } else {
        alert('Failed to restore version.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to restore version.');
    }
  };

  useEffect(() => {
    let wsProvider: WebsocketProvider;
    let isMounted = true;

    async function initCollaboration() {
      try {
        const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceId}/token`);
        if (!res.ok) {
          if (isMounted) setStatus('Access Denied');
          return;
        }
        
        const data = await res.json();
        const { token, role } = data;
        if (isMounted) {
          setRole(role);
        }

        if (!isMounted) return;

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002';

        wsProvider = new WebsocketProvider(wsUrl, `resource:${resourceId}`, ydocRef.current, {
          params: { token },
          connect: true
        });

        wsProvider.on('status', (event: { status: string }) => {
          if (!isMounted) return;
          if (event.status === 'connected') {
            setStatus('Saved');
          } else {
            setStatus('Offline / Reconnecting');
          }
        });
        
        wsProvider.on('connection-error', () => {
           if (isMounted) setStatus('Connection Error');
        });
        
        providerRef.current = wsProvider;
        if (isMounted) setIsReady(true);

      } catch (err) {
        console.error('Failed to init collaboration:', err);
        if (isMounted) setStatus('Error');
      }
    }

    initCollaboration();

    return () => {
      isMounted = false;
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      if (providerRef.current) {
        providerRef.current.disconnect();
        providerRef.current.destroy();
        providerRef.current = null;
      }
      ydocRef.current.destroy();
      ydocRef.current = new Y.Doc();
    };
  }, [workspaceId, projectId, resourceId]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    (window as any).monacoEditor = editor; // Expose for Playwright tests

    // Add context menu action for creating an issue (independent of Yjs connection)
    editor.addAction({
      id: 'create-issue-from-selection',
      label: 'Create Issue from Selection',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed: any) => {
        const selection = ed.getSelection();
        const text = selection ? ed.getModel().getValueInRange(selection) : '';
        const snippetData = {
          text,
          resourceId,
          version: 'latest',
          startLine: selection ? selection.startLineNumber : 1,
          endLine: selection ? selection.endLineNumber : 1
        };
        sessionStorage.setItem('syncforge_pending_issue', JSON.stringify(snippetData));
        router.push(`/workspaces/${workspaceId}/projects/${projectId}/issues?new=true`);
      }
    });

    // We must wait for provider to be ready
    if (!isReady || !providerRef.current) return;

    // Yjs text type
    const type = ydocRef.current.getText('monaco');

    // Bind Monaco editor to Yjs text type
    bindingRef.current = new MonacoBinding(type, editor.getModel(), new Set([editor]), providerRef.current.awareness);

    // Listen for changes to update status to "Saving..."
    ydocRef.current.on('update', () => {
      setStatus('Saving...');
      // It resets to "Saved" effectively when the server debounces. We can simulate a temporary "Saving..." state.
      setTimeout(() => {
        setStatus('Saved');
      }, 1000);
    });
  };

  useEffect(() => {
    if (isReady && editorRef.current && providerRef.current && !bindingRef.current) {
      const type = ydocRef.current.getText('monaco');
      bindingRef.current = new MonacoBinding(type, editorRef.current.getModel(), new Set([editorRef.current]), providerRef.current.awareness);
      
      ydocRef.current.on('update', () => {
        setStatus('Saving...');
        setTimeout(() => {
          setStatus('Saved');
        }, 1000);
      });
    }
  }, [isReady]);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col h-full overflow-hidden w-full relative animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-4 py-3 border-b border-border/50 bg-muted/10">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {filename}
          {isReadOnly && <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-destructive/10 text-destructive border border-destructive/20 rounded-full">Read Only</span>}
        </h2>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${status === 'Saved' || status === 'Saving...' || status === 'Revision Saved!' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-destructive'} ${status === 'Saving...' ? 'animate-pulse' : ''}`}></div>
             <span className="text-xs text-muted-foreground font-medium">{status}</span>
           </div>
           <div className="flex items-center gap-2">
             {!isReadOnly && (
               <Button 
                 variant="outline"
                 size="sm"
                 onClick={handleSaveRevision}
                 disabled={isSavingRevision}
                 className="h-8"
               >
                 <Save className="h-3.5 w-3.5 mr-2" />
                 {isSavingRevision ? 'Saving...' : 'Save Version'}
               </Button>
             )}
             <Button 
               variant="secondary"
               size="sm"
               onClick={() => setShowHistory(!showHistory)}
               className="h-8"
             >
               <History className="h-3.5 w-3.5 mr-2" />
               History
             </Button>
           </div>
        </div>
      </div>
      
      <div className="flex-1 relative w-full h-full">
        {!isReady && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Initializing editor...</span>
            </div>
          </div>
        )}
        <Editor
          height="100%"
          language={getLanguage(filename)}
          theme="vs-dark"
          options={{
            readOnly: isReadOnly,
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
          onMount={handleEditorDidMount}
        />
        
        {showHistory && (
          <HistoryPanel 
            workspaceId={workspaceId}
            projectId={projectId}
            resourceId={resourceId}
            onClose={() => setShowHistory(false)}
            onRestore={handleRestore}
            onPreview={setPreviewVersionId}
            canRestore={!isReadOnly}
          />
        )}

        {previewVersionId && (
          <DiffViewer
             workspaceId={workspaceId}
             projectId={projectId}
             resourceId={resourceId}
             versionId={previewVersionId}
             filename={filename}
             currentContent={ydocRef.current.getText('monaco').toString()}
             onClose={() => setPreviewVersionId(null)}
          />
        )}
      </div>
    </div>
  );
}
