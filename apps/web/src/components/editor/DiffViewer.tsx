import { DiffEditor } from '@monaco-editor/react';
import { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Button } from '../ui/button';
import { X } from 'lucide-react';

interface DiffViewerProps {
  workspaceId: string;
  projectId: string;
  resourceId: string;
  versionId: string;
  currentContent: string;
  filename: string;
  onClose: () => void;
}

const getLanguage = (filename: string) => {
  if (!filename || !filename.includes('.')) return 'plaintext';
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return 'typescript';
    case 'js': case 'jsx': return 'javascript';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'html': return 'html';
    case 'css': return 'css';
    default: return 'plaintext';
  }
};

export function DiffViewer({ workspaceId, projectId, resourceId, versionId, currentContent, filename, onClose }: DiffViewerProps) {
  const { fetchWithAuth } = useWorkspace();
  const [historicalContent, setHistoricalContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceId}/revisions/${versionId}`);
        if (!res.ok) throw new Error('Failed to load version');
        const data = await res.json();
        
        if (data.stateSnapshot) {
           // We need to decode the Yjs state snapshot into text.
           // However, the backend sends the stateSnapshot as a base64 or array buffer maybe?
           // Wait, Prisma returns Bytes as a JSON object { type: 'Buffer', data: [...] } or base64 string depending on serialization.
           // To read Yjs text, we initialize a Y.Doc, apply the snapshot, and read the text.
           import('yjs').then(Y => {
             const ydoc = new Y.Doc();
             let uint8Array: Uint8Array;
             if (data.stateSnapshot.type === 'Buffer' && Array.isArray(data.stateSnapshot.data)) {
               uint8Array = new Uint8Array(data.stateSnapshot.data);
             } else {
               // Assuming base64 if not buffer
               const binaryString = window.atob(data.stateSnapshot);
               const len = binaryString.length;
               const bytes = new Uint8Array(len);
               for (let i = 0; i < len; i++) {
                 bytes[i] = binaryString.charCodeAt(i);
               }
               uint8Array = bytes;
             }
             
             Y.applyUpdate(ydoc, uint8Array);
             // Assume 'monaco' is the name of the text type
             const text = ydoc.getText('monaco').toString();
             setHistoricalContent(text);
             setLoading(false);
           });
        } else {
           setError('Diff preview is only supported for text/code files currently.');
           setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load historical content');
        setLoading(false);
      }
    }
    loadHistory();
  }, [workspaceId, projectId, resourceId, versionId]);

  return (
    <div className="absolute inset-0 z-30 bg-background flex flex-col shadow-xl animate-in fade-in duration-300">
       <div className="flex justify-between items-center px-4 py-3 border-b border-border/50 bg-muted/10">
          <div>
            <h3 className="font-semibold text-foreground">Historical Comparison</h3>
            <p className="text-xs text-muted-foreground">Comparing Version with Current</p>
          </div>
          <Button 
            variant="outline"
            size="sm"
            onClick={onClose} 
            className="h-8"
          >
            <X className="h-3.5 w-3.5 mr-2" />
            Close Diff
          </Button>
       </div>
       <div className="flex-1 relative">
         {loading && (
           <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
             <div className="flex items-center gap-3 text-muted-foreground">
               <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
               <span className="text-sm font-medium">Loading diff...</span>
             </div>
           </div>
         )}
         {error && <div className="absolute inset-0 flex items-center justify-center text-destructive font-medium">{error}</div>}
         {!loading && !error && historicalContent !== null && (
            <DiffEditor
              height="100%"
              language={getLanguage(filename)}
              theme="vs-dark"
              original={historicalContent}
              modified={currentContent}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                wordWrap: 'on',
              }}
            />
         )}
       </div>
    </div>
  );
}
