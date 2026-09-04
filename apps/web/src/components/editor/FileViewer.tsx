'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const CodeEditor = dynamic(() => import('./CodeEditor').then(mod => mod.CodeEditor), { ssr: false });
const DocxViewer = dynamic(() => import('./previews/DocxViewer').then(mod => mod.DocxViewer), { ssr: false });
const SpreadsheetViewer = dynamic(() => import('./previews/SpreadsheetViewer').then(mod => mod.SpreadsheetViewer), { ssr: false });
const ArchiveViewer = dynamic(() => import('./previews/ArchiveViewer').then(mod => mod.ArchiveViewer), { ssr: false });
const PresentationViewer = dynamic(() => import('./previews/PresentationViewer').then(mod => mod.PresentationViewer), { ssr: false });

import { Download, File as FileIcon } from 'lucide-react';
import { getApiUrl } from '../../config/api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getFileCategory, getFileCategoryDisplayName, FileCategory } from '../../utils/fileTypes';
import { HistoryPanel } from './HistoryPanel';
import { Button } from '../ui/button';
import { History } from 'lucide-react';

interface FileViewerProps {
  workspaceId: string;
  projectId: string;
  resourceId: string;
  filename: string;
  initialShowHistory?: boolean;
}

export function FileViewer({ workspaceId, projectId, resourceId, filename, initialShowHistory = false }: FileViewerProps) {
  const { fetchWithAuth } = useWorkspace();
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [isLoadingBlob, setIsLoadingBlob] = useState(false);
  const [showHistory, setShowHistory] = useState(initialShowHistory);

  const category = getFileCategory(filename);
  const displayName = getFileCategoryDisplayName(filename, category);

  const isText = category === FileCategory.TEXT;
  const isImage = category === FileCategory.IMAGE;
  const isPdf = category === FileCategory.PDF;
  const isAudio = category === FileCategory.AUDIO;
  const isVideo = category === FileCategory.VIDEO;
  const isDoc = category === FileCategory.DOCUMENT && filename.toLowerCase().endsWith('.docx');
  const isSpreadsheet = category === FileCategory.SPREADSHEET || category === FileCategory.CSV;
  const isArchive = category === FileCategory.ARCHIVE && filename.toLowerCase().endsWith('.zip');
  const isPresentation = category === FileCategory.PRESENTATION && filename.toLowerCase().endsWith('.pptx');

  const requiresBlob = isImage || isPdf || isAudio || isVideo || isDoc || isSpreadsheet || isArchive || isPresentation;

  useEffect(() => {
    const apiUrl = getApiUrl();
    const url = `${apiUrl}/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceId}/download?t=${Date.now()}`;
    setDownloadUrl(url);

    if (requiresBlob) {
      setIsLoadingBlob(true);
      fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceId}/download`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load file');
          return res.blob();
        })
        .then(blob => {
          const u = URL.createObjectURL(blob);
          setBlobUrl(u);
          setIsLoadingBlob(false);
        })
        .catch(() => {
          setIsLoadingBlob(false);
        });
    }
  }, [workspaceId, projectId, resourceId, requiresBlob, fetchWithAuth]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (!downloadUrl) return null;

  if (isText) {
    return (
      <CodeEditor
        workspaceId={workspaceId}
        projectId={projectId}
        resourceId={resourceId}
        filename={filename}
        initialShowHistory={initialShowHistory}
      />
    );
  }

  const handleDownload = () => {
    fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceId}/download`)
      .then(res => res.blob())
      .then(blob => {
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = u;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(u);
      });
  };

  const handleRestore = async (versionId: string) => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceId}/revisions/${versionId}/restore`, {
        method: 'POST'
      });
      if (res.ok) {
        setShowHistory(false);
        // Reload blob by forcing state refresh
        setBlobUrl('');
        setIsLoadingBlob(true);
        fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceId}/download?t=${Date.now()}`)
          .then(r => r.blob())
          .then(blob => {
            setBlobUrl(URL.createObjectURL(blob));
            setIsLoadingBlob(false);
          });
      } else {
        alert('Failed to restore version.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to restore version.');
    }
  };

  return (
    <div className="flex flex-col h-full border border-border shadow-sm rounded-xl overflow-hidden bg-card relative animate-in fade-in duration-500">
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/10">
        <div className="flex items-center gap-3 truncate max-w-[70%] px-1">
          <span className="text-sm font-semibold text-foreground truncate">
            {filename}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 border border-border text-muted-foreground uppercase tracking-wider font-bold">
            {displayName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="secondary"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="h-8"
          >
            <History className="h-3.5 w-3.5 mr-2" />
            History
          </Button>
          <Button 
            variant="default"
            size="sm"
            onClick={handleDownload}
            className="h-8"
          >
            <Download className="h-3.5 w-3.5 mr-2" /> 
            Download
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-muted/5 relative">
        {isLoadingBlob && requiresBlob && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Loading preview...</span>
            </div>
          </div>
        )}

        {!isLoadingBlob && isImage && blobUrl && (
          <img 
            src={blobUrl} 
            alt={filename} 
            className="max-w-full max-h-full object-contain shadow-sm rounded"
          />
        )}
        
        {!isLoadingBlob && isPdf && blobUrl && (
          <object
            data={blobUrl}
            type="application/pdf"
            className="w-full h-full rounded"
          >
            <p>PDF preview not available. <button onClick={handleDownload} className="text-blue-500 hover:underline">Download instead</button>.</p>
          </object>
        )}

        {!isLoadingBlob && isAudio && blobUrl && (
          <audio controls src={blobUrl} className="w-full max-w-md">
            Your browser does not support the audio element.
          </audio>
        )}

        {!isLoadingBlob && isVideo && blobUrl && (
          <video controls src={blobUrl} className="max-w-full max-h-full rounded shadow-sm">
            Your browser does not support the video element.
          </video>
        )}

        {!isLoadingBlob && isDoc && blobUrl && (
          <DocxViewer blobUrl={blobUrl} filename={filename} onDownload={handleDownload} />
        )}

        {!isLoadingBlob && isSpreadsheet && blobUrl && (
          <SpreadsheetViewer blobUrl={blobUrl} filename={filename} onDownload={handleDownload} />
        )}

        {!isLoadingBlob && isArchive && blobUrl && (
          <ArchiveViewer blobUrl={blobUrl} filename={filename} onDownload={handleDownload} />
        )}

        {!isLoadingBlob && isPresentation && blobUrl && (
          <PresentationViewer blobUrl={blobUrl} filename={filename} onDownload={handleDownload} />
        )}

        {(!requiresBlob) || (!isLoadingBlob && requiresBlob && !blobUrl) ? (
          <div className="flex flex-col items-center gap-4 text-muted-foreground bg-background p-8 rounded-xl border border-border shadow-sm max-w-sm w-full text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
               <FileIcon size={24} className="text-muted-foreground/50" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">{filename}</p>
              <p className="text-sm text-muted-foreground/80">
                {requiresBlob ? 'Failed to load preview.' : `Preview not supported for this file type.`}
              </p>
              {!requiresBlob && <p className="text-[10px] mt-2 font-bold uppercase tracking-wider text-muted-foreground/50">{displayName}</p>}
            </div>
            <Button 
              onClick={handleDownload}
              className="mt-4 w-full"
            >
              <Download size={14} className="mr-2" /> Download File
            </Button>
          </div>
        ) : null}
      </div>
      
      {showHistory && (
        <HistoryPanel 
          workspaceId={workspaceId}
          projectId={projectId}
          resourceId={resourceId}
          onClose={() => setShowHistory(false)}
          onRestore={handleRestore}
          onPreview={(id) => alert('Diff preview is only supported for text/code files.')}
          canRestore={true} // In a real app we'd check permissions
        />
      )}
    </div>
  );
}
