'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useRouter } from 'next/navigation';
import { Folder, FolderOpen, FileText, File as FileIcon, MoreVertical, Edit2, Trash2, ChevronRight, ChevronDown, Upload, Download, FileCode, ImageIcon, FileVideo, FileAudio, FileArchive } from 'lucide-react';
import { getFileCategory, FileCategory } from '../../utils/fileTypes';

interface Resource {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  type: 'FOLDER' | 'PAGE' | 'FILE';
  position: number;
  page?: { id: string };
}

interface ProjectExplorerProps {
  workspaceId: string;
  projectId: string;
  onFileSelect?: (resource: Resource) => void;
}

export function ProjectExplorer({ workspaceId, projectId, onFileSelect }: ProjectExplorerProps) {
  const { fetchWithAuth } = useWorkspace();
  const router = useRouter();
  
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`syncforge_expanded_${projectId}`);
      if (saved) {
        try { return new Set<string>(JSON.parse(saved)); } catch (e) {}
      }
    }
    return new Set<string>();
  });
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`syncforge_expanded_${projectId}`, JSON.stringify([...Array.from(expandedFolders)]));
    }
  }, [expandedFolders, projectId]);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, resourceId: string | null } | null>(null);
  
  // Modals / Input State
  const [isCreating, setIsCreating] = useState<{ type: 'FOLDER' | 'PAGE' | 'FILE', parentId: string | null } | null>(null);
  const [isRenaming, setIsRenaming] = useState<Resource | null>(null);
  const [inputValue, setInputValue] = useState('');
  
  // File Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  
  // Drag and Drop
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const fetchResources = async () => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources`);
      if (res.ok) {
        const data = await res.json();
        setResources(data.resources);
      } else {
        throw new Error('Failed to load resources');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
    
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [workspaceId, projectId]);

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, resourceId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, resourceId });
  };

  const handleCreate = async () => {
    if (!isCreating || !inputValue.trim()) return;
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources`, {
        method: 'POST',
        body: JSON.stringify({
          name: inputValue,
          type: isCreating.type,
          parentId: isCreating.parentId
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (isCreating.parentId) {
          setExpandedFolders(prev => new Set(prev).add(isCreating.parentId!));
        }
        await fetchResources();
        if (isCreating.type === 'PAGE' && data.resource.page?.id) {
          router.push(`/workspaces/${workspaceId}/projects/${projectId}/pages/${data.resource.page.id}`);
        }
      } else {
        const err = await res.json();
        setError(err.error?.message || 'Failed to create');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setIsCreating(null);
    setInputValue('');
  };

  const handleRename = async () => {
    if (!isRenaming || !inputValue.trim()) return;
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${isRenaming.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: inputValue })
      });
      if (res.ok) {
        await fetchResources();
      } else {
        const err = await res.json();
        setError(err.error?.message || 'Failed to rename');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setIsRenaming(null);
    setInputValue('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource and all its contents?')) return;
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchResources();
      } else {
        const err = await res.json();
        setError(err.error?.message || 'Failed to delete');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpload = async (file: globalThis.File, parentId: string | null) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const url = parentId 
        ? `/api/workspaces/${workspaceId}/projects/${projectId}/resources/${parentId}/upload`
        : `/api/workspaces/${workspaceId}/projects/${projectId}/resources/upload`;
        
      const res = await fetchWithAuth(url, {
        method: 'POST',
        headers: { 'Content-Type': 'undefined' } as any, 
        body: formData
      });
      
      if (res.ok) {
        if (parentId) setExpandedFolders(prev => new Set(prev).add(parentId));
        await fetchResources();
      } else {
        const err = await res.json();
        setError(err.error?.message || 'Failed to upload');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDownload = async (resourceId: string) => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/resources/${resourceId}/download`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      
      const disposition = res.headers.get('content-disposition');
      let filename = 'download';
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]+)"/.exec(disposition);
        if (matches != null && matches[1]) filename = decodeURIComponent(matches[1]);
      }
      a.download = filename;
      a.click();
      URL.revokeObjectURL(u);
    } catch (err: any) {
      setError('Failed to download file');
    }
  };

  const handleDrop = (e: React.DragEvent, parentId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleUpload(file, parentId);
    }
  };

  const renderFileIcon = (filename: string) => {
    const category = getFileCategory(filename);
    switch (category) {
      case FileCategory.TEXT:
        return <FileCode size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />;
      case FileCategory.IMAGE:
        return <ImageIcon size={16} className="text-pink-500 dark:text-pink-400 shrink-0" />;
      case FileCategory.VIDEO:
        return <FileVideo size={16} className="text-purple-500 dark:text-purple-400 shrink-0" />;
      case FileCategory.AUDIO:
        return <FileAudio size={16} className="text-yellow-600 dark:text-yellow-400 shrink-0" />;
      case FileCategory.PDF:
      case FileCategory.DOCUMENT:
        return <FileText size={16} className="text-red-500 dark:text-red-400 shrink-0" />;
      case FileCategory.ARCHIVE:
        return <FileArchive size={16} className="text-orange-500 dark:text-orange-400 shrink-0" />;
      default:
        return <FileIcon size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />;
    }
  };

  const renderTree = (parentId: string | null = null, depth: number = 0) => {
    const children = resources.filter(r => r.parentId === parentId);
    
    return children.map(resource => {
      const isExpanded = expandedFolders.has(resource.id);
      const isFolder = resource.type === 'FOLDER';
      const isPage = resource.type === 'PAGE';
      const isFile = resource.type === 'FILE';

      const paddingLeft = `${depth * 1.5 + 0.5}rem`;

      const hasChildren = resources.some(r => r.parentId === resource.id);
      
      return (
        <div key={resource.id}>
          <div 
            className={`group flex items-center justify-between hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer py-1 text-sm rounded pr-2 select-none ${activeFolderId === resource.id ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500/20' : ''} ${dragOverId === resource.id ? 'bg-blue-100 dark:bg-blue-900/40 border border-blue-400' : ''}`}
            style={{ paddingLeft }}
            onDragOver={(e) => {
              if (isFolder) {
                e.preventDefault();
                e.stopPropagation();
                setDragOverId(resource.id);
              }
            }}
            onDragLeave={(e) => {
              if (isFolder) {
                e.preventDefault();
                e.stopPropagation();
                if (dragOverId === resource.id) setDragOverId(null);
              }
            }}
            onDrop={(e) => {
              if (isFolder) handleDrop(e, resource.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (isFolder) {
                setActiveFolderId(resource.id);
                toggleFolder(resource.id);
              } else if (isPage) {
                setActiveFolderId(resource.parentId);
                if (resource.page?.id) {
                  router.push(`/workspaces/${workspaceId}/projects/${projectId}/pages/${resource.page.id}`);
                }
              } else if (isFile && onFileSelect) {
                setActiveFolderId(resource.parentId);
                onFileSelect(resource);
              }
            }}
            onContextMenu={(e) => {
              handleContextMenu(e, resource.id);
              if (isFolder) setActiveFolderId(resource.id);
            }}
          >
            <div className="flex items-center gap-1.5 overflow-hidden w-full">
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                {isFolder && (
                  isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />
                )}
              </div>
              
              {isFolder ? (isExpanded ? <FolderOpen size={16} className="text-blue-500 shrink-0" /> : <Folder size={16} className="text-blue-500 shrink-0" />) :
               isPage ? <FileText size={16} className="text-gray-500 dark:text-gray-400 shrink-0" /> :
               renderFileIcon(resource.name)}
              
              {isRenaming?.id === resource.id ? (
                <input 
                  autoFocus
                  className="bg-white dark:bg-zinc-900 border border-blue-500 rounded px-1 w-full text-sm outline-none"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRename();
                    if (e.key === 'Escape') setIsRenaming(null);
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="truncate">{resource.name}</span>
              )}
            </div>
            <button 
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-opacity"
              onClick={(e) => handleContextMenu(e, resource.id)}
            >
              <MoreVertical size={14} className="text-gray-500" />
            </button>
          </div>
            
          {/* Input field for creating a new resource inside this folder */}
          {isExpanded && isCreating?.parentId === resource.id && (
             <div className="flex items-center gap-1.5 py-1 pr-2" style={{ paddingLeft: `calc(${paddingLeft} + 1rem)` }}>
                <div className="w-4 h-4 shrink-0" /> {/* Chevron placeholder */}
                {isCreating.type === 'FOLDER' ? <Folder size={16} className="text-blue-500 shrink-0" /> : 
                 isCreating.type === 'PAGE' ? <FileText size={16} className="text-gray-500 shrink-0" /> : 
                 <FileIcon size={16} className="text-gray-500 shrink-0" />}
                <input 
                  autoFocus
                  className="bg-white dark:bg-zinc-900 border border-blue-500 rounded px-1 w-full text-sm outline-none"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onBlur={() => { if(inputValue.trim()) handleCreate(); else setIsCreating(null); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') setIsCreating(null);
                  }}
                />
             </div>
          )}

          {isFolder && isExpanded && renderTree(resource.id, depth + 1)}
        </div>
      );
    });
  };

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading resources...</div>;

  return (
    <div className={`bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded flex flex-col h-full min-h-[500px] ${dragOverId === 'root' ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/10' : ''}`}
         onContextMenu={(e) => handleContextMenu(e, null)}
         onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId('root'); }}
         onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (dragOverId === 'root') setDragOverId(null); }}
         onDrop={(e) => handleDrop(e, null)}>
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUpload(e.target.files[0], uploadTargetId);
          }
          // Reset target
          if (fileInputRef.current) fileInputRef.current.value = '';
        }} 
      />
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-100/50 dark:bg-zinc-900">
        <h3 className="font-semibold text-sm tracking-wide text-gray-700 dark:text-gray-300">EXPLORER</h3>
        <div className="flex items-center gap-1">
          <button title="New Page" onClick={() => { setIsCreating({ type: 'PAGE', parentId: activeFolderId }); setInputValue(''); if (activeFolderId) setExpandedFolders(prev => new Set(prev).add(activeFolderId)); }} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded"><FileText size={14} /></button>
          <button title="New Folder" onClick={() => { setIsCreating({ type: 'FOLDER', parentId: activeFolderId }); setInputValue(''); if (activeFolderId) setExpandedFolders(prev => new Set(prev).add(activeFolderId)); }} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded"><Folder size={14} /></button>
          <button title="Upload File" onClick={() => { setUploadTargetId(activeFolderId); fileInputRef.current?.click(); }} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded"><Upload size={14} /></button>
        </div>
      </div>
      
      {error && <div className="px-3 py-2 text-xs text-red-500 border-b border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 break-words">{error}</div>}

      <div className="flex-1 overflow-y-auto py-2" onClick={() => { setIsCreating(null); setIsRenaming(null); setActiveFolderId(null); }}>
        {renderTree(null, 0)}
        
        {/* Root level create input */}
        {isCreating?.parentId === null && (
          <div className="flex items-center gap-1.5 py-1 px-2">
            <div className="w-4 h-4 shrink-0" />
            {isCreating.type === 'FOLDER' ? <Folder size={16} className="text-blue-500 shrink-0" /> : 
             isCreating.type === 'PAGE' ? <FileText size={16} className="text-gray-500 shrink-0" /> : 
             <FileIcon size={16} className="text-gray-500 shrink-0" />}
            <input 
              autoFocus
              className="bg-white dark:bg-zinc-900 border border-blue-500 rounded px-1 w-full text-sm outline-none"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onBlur={() => { if(inputValue.trim()) handleCreate(); else setIsCreating(null); }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setIsCreating(null);
              }}
            />
          </div>
        )}
      </div>

      {contextMenu && (
        <div 
          className="fixed bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded shadow-lg py-1 z-50 text-sm min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.resourceId ? (
            <>
              {resources.find(r => r.id === contextMenu.resourceId)?.type === 'FOLDER' && (
                <>
                  <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                    onClick={() => { setIsCreating({ type: 'PAGE', parentId: contextMenu.resourceId }); setInputValue(''); setContextMenu(null); setExpandedFolders(prev => new Set(prev).add(contextMenu.resourceId!)); }}>
                    <FileText size={14} /> New Page
                  </button>
                  <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                    onClick={() => { setIsCreating({ type: 'FOLDER', parentId: contextMenu.resourceId }); setInputValue(''); setContextMenu(null); setExpandedFolders(prev => new Set(prev).add(contextMenu.resourceId!)); }}>
                    <Folder size={14} /> New Folder
                  </button>
                  <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                    onClick={() => { setIsCreating({ type: 'FILE', parentId: contextMenu.resourceId }); setInputValue(''); setContextMenu(null); setExpandedFolders(prev => new Set(prev).add(contextMenu.resourceId!)); }}>
                    <FileIcon size={14} /> New File Metadata
                  </button>
                  <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                    onClick={() => { setUploadTargetId(contextMenu.resourceId); fileInputRef.current?.click(); setContextMenu(null); setExpandedFolders(prev => new Set(prev).add(contextMenu.resourceId!)); }}>
                    <Upload size={14} /> Upload File
                  </button>
                  <div className="h-px bg-gray-200 dark:bg-zinc-700 my-1"></div>
                </>
              )}
              {resources.find(r => r.id === contextMenu.resourceId)?.type === 'PAGE' && (
                <>
                  <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                    onClick={() => { 
                      const r = resources.find(r => r.id === contextMenu.resourceId);
                      if (r) {
                        setActiveFolderId(r.parentId);
                        if (r.page?.id) router.push(`/workspaces/${workspaceId}/projects/${projectId}/pages/${r.page.id}`);
                      }
                      setContextMenu(null); 
                    }}>
                    <FolderOpen size={14} /> Open
                  </button>
                  <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                    onClick={() => { 
                      if (onFileSelect) {
                        const r = resources.find(r => r.id === contextMenu.resourceId);
                        if (r) onFileSelect({...r, action: 'history'} as any);
                      }
                      setContextMenu(null); 
                    }}>
                    <FileText size={14} /> History
                  </button>
                </>
              )}
              {resources.find(r => r.id === contextMenu.resourceId)?.type === 'FILE' && (
                <>
                  <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                    onClick={() => { 
                      if (onFileSelect) {
                        const r = resources.find(r => r.id === contextMenu.resourceId);
                        if (r) onFileSelect(r);
                      }
                      setContextMenu(null); 
                    }}>
                    <FolderOpen size={14} /> Open
                  </button>
                  <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                    onClick={() => { handleDownload(contextMenu.resourceId!); setContextMenu(null); }}>
                    <Download size={14} /> Download
                  </button>
                  <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                    onClick={() => { 
                      if (onFileSelect) {
                        const r = resources.find(r => r.id === contextMenu.resourceId);
                        if (r) onFileSelect({...r, action: 'history'} as any);
                      }
                      setContextMenu(null); 
                    }}>
                    <FileText size={14} /> History
                  </button>
                  <div className="h-px bg-gray-200 dark:bg-zinc-700 my-1"></div>
                </>
              )}
              <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                onClick={() => { 
                  const r = resources.find(r => r.id === contextMenu.resourceId);
                  if (r) { setIsRenaming(r); setInputValue(r.name); setContextMenu(null); }
                }}>
                <Edit2 size={14} /> Rename
              </button>
              <button className="w-full text-left px-4 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 flex items-center gap-2"
                onClick={() => { handleDelete(contextMenu.resourceId!); setContextMenu(null); }}>
                <Trash2 size={14} /> Delete
              </button>
            </>
          ) : (
            <>
              <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                onClick={() => { setIsCreating({ type: 'PAGE', parentId: null }); setInputValue(''); setContextMenu(null); }}>
                <FileText size={14} /> New Page
              </button>
              <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                onClick={() => { setIsCreating({ type: 'FOLDER', parentId: null }); setInputValue(''); setContextMenu(null); }}>
                <Folder size={14} /> New Folder
              </button>
              <button className="w-full text-left px-4 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                onClick={() => { setUploadTargetId(null); fileInputRef.current?.click(); setContextMenu(null); }}>
                <Upload size={14} /> Upload File
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
