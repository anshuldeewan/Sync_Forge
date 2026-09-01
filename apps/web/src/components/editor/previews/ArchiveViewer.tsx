'use client';

import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { Download, FileArchive, Folder, File as FileIcon, HardDrive, FileText, FileCode, ImageIcon } from 'lucide-react';
import { getFileCategory, FileCategory } from '../../../utils/fileTypes';

interface ArchiveViewerProps {
  blobUrl: string;
  filename: string;
  onDownload: () => void;
}

interface ZipEntry {
  name: string;
  dir: boolean;
  size: number;
  date: Date;
  path: string[];
}

interface TreeNode {
  name: string;
  dir: boolean;
  size: number;
  children: Record<string, TreeNode>;
  expanded: boolean;
}

export function ArchiveViewer({ blobUrl, filename, onDownload }: ArchiveViewerProps) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function loadArchive() {
      try {
        setLoading(true);
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        let fileCount = 0;
        let sizeCount = 0;
        
        const root: TreeNode = { name: 'root', dir: true, size: 0, children: {}, expanded: true };

        zip.forEach((relativePath, zipEntry) => {
          // Protect against path traversal conceptually, though JSZip mostly normalizes.
          // We split by '/' and build a tree.
          const parts = relativePath.split('/').filter(p => p.length > 0 && p !== '.' && p !== '..');
          
          let current = root;
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            const isDir = isLast ? zipEntry.dir : true;
            
            if (!current.children[part]) {
              current.children[part] = {
                name: part,
                dir: isDir,
                size: isLast && !isDir ? (zipEntry as any)._data?.uncompressedSize || 0 : 0, // JSZip internal size access fallback
                children: {},
                expanded: false
              };
              
              if (!isDir) {
                fileCount++;
                const sz = (zipEntry as any)._data?.uncompressedSize || 0;
                sizeCount += sz;
                current.children[part].size = sz;
              }
            }
            current = current.children[part];
          }
        });

        if (isMounted) {
          setTree(root);
          setTotalFiles(fileCount);
          setTotalSize(sizeCount);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to parse archive file');
          setLoading(false);
        }
      }
    }

    loadArchive();

    return () => {
      isMounted = false;
    };
  }, [blobUrl]);

  const toggleNode = (node: TreeNode, pathStr: string) => {
    // To update the tree, we need to clone it. A simple deep clone or a focused clone is needed.
    // For simplicity, we can just mutate and force update, or deep clone.
    const newTree = JSON.parse(JSON.stringify(tree)); // Deep clone is fine for UI state here
    
    let current = newTree;
    if (pathStr) {
      const parts = pathStr.split('/');
      for (const part of parts) {
        current = current.children[part];
      }
    }
    
    if (current) {
      current.expanded = !current.expanded;
      setTree(newTree);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderIcon = (name: string, isDir: boolean, expanded: boolean) => {
    if (isDir) {
      return <Folder size={16} className="text-blue-500 shrink-0" />;
    }
    const cat = getFileCategory(name);
    switch (cat) {
      case FileCategory.TEXT: return <FileCode size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />;
      case FileCategory.IMAGE: return <ImageIcon size={16} className="text-pink-500 dark:text-pink-400 shrink-0" />;
      default: return <FileIcon size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />;
    }
  };

  const renderTree = (node: TreeNode, pathStr: string = '', depth: number = 0) => {
    const children = Object.values(node.children).sort((a, b) => {
      if (a.dir === b.dir) return a.name.localeCompare(b.name);
      return a.dir ? -1 : 1;
    });

    return (
      <div key={pathStr || 'root'}>
        {pathStr !== '' && (
          <div 
            className="flex items-center justify-between py-1 px-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded cursor-pointer select-none"
            style={{ paddingLeft: `${depth * 1.2 + 0.5}rem` }}
            onClick={() => node.dir && toggleNode(node, pathStr)}
          >
            <div className="flex items-center gap-2 truncate">
              {renderIcon(node.name, node.dir, node.expanded)}
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{node.name}</span>
            </div>
            {!node.dir && node.size > 0 && (
              <span className="text-xs text-gray-500 shrink-0 ml-4">{formatSize(node.size)}</span>
            )}
          </div>
        )}
        
        {(node.expanded || pathStr === '') && children.map(child => 
          renderTree(child, pathStr ? `${pathStr}/${child.name}` : child.name, pathStr === '' ? depth : depth + 1)
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        Loading archive contents...
      </div>
    );
  }

  if (error || !tree) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">Preview Unavailable</h3>
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <button 
          onClick={onDownload}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          <Download size={16} /> Download {filename}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-black">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-500">
            <FileArchive size={20} />
          </div>
          <div>
            <h3 className="font-medium text-gray-800 dark:text-gray-200">{filename}</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
              <span className="flex items-center gap-1"><HardDrive size={12}/> {totalFiles} files</span>
              {totalSize > 0 && <span>{formatSize(totalSize)} uncompressed</span>}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-zinc-950">
        <div className="bg-white dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800 p-2 shadow-sm min-h-full">
          {Object.keys(tree.children).length > 0 ? (
            renderTree(tree)
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">Archive is empty</div>
          )}
        </div>
      </div>
    </div>
  );
}
