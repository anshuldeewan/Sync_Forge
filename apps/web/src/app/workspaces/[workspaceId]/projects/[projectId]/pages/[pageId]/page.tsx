'use client';

import { useWorkspace } from '../../../../../../../context/WorkspaceContext';
import { useAuth } from '../../../../../../../context/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Editor } from '../../../../../../../components/editor/Editor';

export default function PageEditorRoute() {
  const params = useParams();
  const router = useRouter();
  const { fetchWithAuth } = useWorkspace();
  const { user, loading: authLoading } = useAuth();
  
  const workspaceId = params.workspaceId as string;
  const projectId = params.projectId as string;
  const pageId = params.pageId as string;
  
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/');
      return;
    }

    async function loadPage() {
      try {
        const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}`);
        if (res.ok) {
          const data = await res.json();
          setPage(data.page);
        } else {
          router.push(`/workspaces/${workspaceId}/projects/${projectId}`);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadPage();
  }, [workspaceId, projectId, pageId, authLoading, user]);

  if (authLoading || loading) return <div className="p-6">Loading page...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 p-6">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        <div>
          <button 
            onClick={() => router.push(`/workspaces/${workspaceId}/projects/${projectId}`)}
            className="text-sm text-gray-500 hover:underline mb-2"
          >
            &larr; Back to Project
          </button>
          <h1 className="text-3xl font-bold">{page?.title || 'Untitled Page'}</h1>
        </div>
        
        <Editor 
          workspaceId={workspaceId} 
          projectId={projectId} 
          pageId={pageId} 
        />
      </div>
    </div>
  );
}
