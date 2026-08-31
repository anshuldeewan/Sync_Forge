'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface FilesListProps {
  workspaceId: string;
  projectId: string;
  refreshTrigger: number;
}

export function FilesList({ workspaceId, projectId, refreshTrigger }: FilesListProps) {
  const { fetchWithAuth } = useWorkspace();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // We don't have the user role directly here, we could parse it from context but for now
  // the server handles the authorization. A more advanced UI would hide delete for VIEWER.

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files);
      } else {
        const data = await res.json();
        setError(data.error?.message || 'Failed to load files');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId, fetchWithAuth]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles, refreshTrigger]);

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/files/${fileId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadFiles();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Delete failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/files/${fileId}`);
      if (!res.ok) {
        const data = await res.json();
        alert(data.error?.message || 'Download failed');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="text-gray-500">Loading files...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (files.length === 0) return <div className="text-gray-500 border-2 border-dashed border-gray-300 dark:border-zinc-700 p-8 text-center rounded">No files uploaded yet.</div>;

  return (
    <div className="bg-white dark:bg-black rounded border border-gray-200 dark:border-zinc-800 overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
          <tr>
            <th className="px-4 py-3 font-medium">Filename</th>
            <th className="px-4 py-3 font-medium">Size</th>
            <th className="px-4 py-3 font-medium">Uploader</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
          {files.map(file => (
            <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
              <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" onClick={() => handleDownload(file.id, file.filename)}>
                {file.filename}
              </td>
              <td className="px-4 py-3 text-gray-500">{(file.size / 1024).toFixed(1)} KB</td>
              <td className="px-4 py-3 text-gray-500">{file.uploader?.displayName || 'Unknown'}</td>
              <td className="px-4 py-3 text-gray-500">{new Date(file.createdAt).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => handleDelete(file.id)}
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
