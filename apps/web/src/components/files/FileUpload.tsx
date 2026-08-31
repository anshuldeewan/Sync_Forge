'use client';

import { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface FileUploadProps {
  workspaceId: string;
  projectId: string;
  onUploadSuccess: () => void;
}

export function FileUpload({ workspaceId, projectId, onUploadSuccess }: FileUploadProps) {
  const { fetchWithAuth } = useWorkspace();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/files`, {
        method: 'POST',
        body: formData,
        // Remove Content-Type so browser sets it with boundaries automatically
        headers: { 'Content-Type': undefined as any }
      });
      
      // We manually remove Content-Type from headers so fetch uses multipart/form-data boundary
      // But fetchWithAuth sets it to application/json by default. Let's fix that.
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Upload failed');
      }

      setFile(null);
      // Reset file input
      const input = document.getElementById('file-upload') as HTMLInputElement;
      if (input) input.value = '';
      
      onUploadSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-4 rounded mb-6">
      <h3 className="text-lg font-medium mb-4">Upload File</h3>
      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        <div>
          <input
            id="file-upload"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              dark:file:bg-zinc-800 dark:file:text-zinc-300
              dark:hover:file:bg-zinc-700"
            disabled={uploading}
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={!file || uploading}
          className="self-start bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
    </div>
  );
}
