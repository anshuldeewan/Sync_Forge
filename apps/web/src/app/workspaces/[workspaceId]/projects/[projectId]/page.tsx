'use client';

import { useWorkspace } from '../../../../../context/WorkspaceContext';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FileUpload } from '../../../../../components/files/FileUpload';
import { FilesList } from '../../../../../components/files/FilesList';
import { PagesList } from '../../../../../components/pages/PagesList';

export default function ProjectPage() {
  const { workspaces, activeWorkspace } = useWorkspace();
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const projectId = params.projectId as string;
  const [project, setProject] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (activeWorkspace && activeWorkspace.id === workspaceId) {
      const found = activeWorkspace.projects?.find(p => p.id === projectId);
      if (found) {
        setProject(found);
      } else {
        // Project not found, maybe redirect
        router.push(`/workspaces/${workspaceId}`);
      }
    }
  }, [activeWorkspace, workspaceId, projectId, router]);

  if (!project) {
    return <div className="p-6">Loading project...</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 p-6">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button 
              onClick={() => router.push('/')}
              className="text-sm text-gray-500 hover:underline mb-2"
            >
              &larr; Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold">{project.name}</h1>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Main content area (e.g. Pages, etc will go here in Phase 6) */}
            <PagesList workspaceId={workspaceId} projectId={projectId} />
          </div>
          
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Files</h2>
            <FileUpload 
              workspaceId={workspaceId} 
              projectId={projectId} 
              onUploadSuccess={() => setRefreshTrigger(t => t + 1)} 
            />
            <FilesList 
              workspaceId={workspaceId} 
              projectId={projectId} 
              refreshTrigger={refreshTrigger} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
