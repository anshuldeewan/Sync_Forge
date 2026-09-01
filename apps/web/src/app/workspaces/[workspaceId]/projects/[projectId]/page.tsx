'use client';

import { useWorkspace } from '../../../../../context/WorkspaceContext';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProjectExplorer } from '../../../../../components/explorer/ProjectExplorer';
import { Editor } from '../../../../../components/editor/Editor';
import { FileViewer } from '../../../../../components/editor/FileViewer';
import { NotificationBell } from '../../../../../components/NotificationBell';

export default function ProjectPage() {
  const { workspaces, activeWorkspace } = useWorkspace();
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const projectId = params.projectId as string;
  const [project, setProject] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);

  useEffect(() => {
    if (activeWorkspace && activeWorkspace.id === workspaceId) {
      const found = activeWorkspace.projects?.find(p => p.id === projectId);
      if (found) {
        setProject(found);
      } else {
        router.push(`/workspaces/${workspaceId}`);
      }
    }
  }, [activeWorkspace, workspaceId, projectId, router]);

  if (!project) {
    return <div className="p-6">Loading project...</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 p-6">
      <div className="max-w-6xl mx-auto w-full space-y-6">
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/workspaces/${workspaceId}/projects/${projectId}/issues`)}
              className="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              Issues
            </button>
            <NotificationBell />
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 h-[600px]">
            <ProjectExplorer 
              workspaceId={workspaceId} 
              projectId={projectId} 
              onFileSelect={(resource) => setSelectedFile(resource)}
            />
          </div>
          
          <div className="lg:col-span-3 space-y-6">
            {selectedFile ? (
              selectedFile.type === 'PAGE' ? (
                <Editor 
                  workspaceId={workspaceId}
                  projectId={projectId}
                  pageId={selectedFile.page?.id || selectedFile.id}
                  key={selectedFile.id} // force remount on file switch
                  initialShowHistory={selectedFile.action === 'history'}
                />
              ) : selectedFile.type === 'FILE' ? (
                <FileViewer
                  workspaceId={workspaceId}
                  projectId={projectId}
                  resourceId={selectedFile.id}
                  filename={selectedFile.name}
                  key={selectedFile.id}
                  initialShowHistory={selectedFile.action === 'history'}
                />
              ) : (
                <div className="bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-zinc-800 p-8 flex flex-col items-center justify-center min-h-[400px] text-center text-gray-500">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">{selectedFile.name}</h2>
                  <p className="max-w-md">
                    This resource type cannot be edited.
                  </p>
                </div>
              )
            ) : (
              <div className="bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-zinc-800 p-8 flex flex-col items-center justify-center min-h-[400px] text-center text-gray-500">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Welcome to your Project</h2>
                <p className="max-w-md">Select a page or file from the explorer on the left to view or edit it. Right click on the explorer to create folders and resources.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
