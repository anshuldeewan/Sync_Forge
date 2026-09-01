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
    <div className="flex flex-col h-[600px] border border-gray-200 dark:border-zinc-800 rounded overflow-hidden bg-white dark:bg-black relative">
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900">
        <div className="flex items-center gap-3 truncate max-w-[70%]">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
            {filename}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300">
            {displayName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-zinc-600 flex-shrink-0"
          >
            History
          </button>
          <button 
            onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 flex-shrink-0"
          >
            <Download size={14} /> Download
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-100 dark:bg-zinc-900 relative">
        {isLoadingBlob && requiresBlob && (
          <div className="text-gray-500">Loading preview...</div>
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
          <div className="flex flex-col items-center gap-4 text-gray-500">
            <FileIcon size={48} className="text-gray-400" />
            <div className="text-center">
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">{filename}</p>
              <p className="text-sm">
                {requiresBlob ? 'Failed to load preview.' : `Preview not supported for this file type.`}
              </p>
              {!requiresBlob && <p className="text-xs mt-1 text-gray-400">{displayName}</p>}
            </div>
            <button 
              onClick={handleDownload}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Download size={16} /> Download File
            </button>
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
