'use client';

import { useWorkspace } from '../../../../../context/WorkspaceContext';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProjectExplorer } from '../../../../../components/explorer/ProjectExplorer';
import { Editor } from '../../../../../components/editor/Editor';
import { FileViewer } from '../../../../../components/editor/FileViewer';
import { AppShell } from '../../../../../components/layout/AppShell';
import { PageHeader } from '../../../../../components/layout/PageHeader';
import { Button } from '../../../../../components/ui/button';
import { ListTodo } from 'lucide-react';

export default function ProjectPage() {
  const { activeWorkspace } = useWorkspace();
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
    return (
      <AppShell>
        <div className="p-6 text-muted-foreground animate-pulse">Loading project...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col space-y-6 h-[calc(100vh-8rem)] animate-in fade-in duration-500">
        <PageHeader 
          title={project.name}
          breadcrumbs={
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
               <a href={`/workspaces/${workspaceId}`} className="hover:underline">Workspace</a>
               <span>/</span>
               <span className="text-foreground">{project.name}</span>
            </div>
          }
          actions={
            <Button
              variant="outline"
              onClick={() => router.push(`/workspaces/${workspaceId}/projects/${projectId}/issues`)}
            >
              <ListTodo className="mr-2 h-4 w-4" />
              Issues
            </Button>
          }
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
          <div className="lg:col-span-1 h-full overflow-hidden rounded-xl border bg-card shadow-sm">
            <ProjectExplorer 
              workspaceId={workspaceId} 
              projectId={projectId} 
              onFileSelect={(resource) => setSelectedFile(resource)}
            />
          </div>
          
          <div className="lg:col-span-3 h-full overflow-hidden rounded-xl border bg-card shadow-sm">
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
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                  <h2 className="text-xl font-semibold text-foreground mb-2">{selectedFile.name}</h2>
                  <p className="max-w-md">This resource type cannot be edited.</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8 bg-muted/20">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <ListTodo className="h-6 w-6 text-primary opacity-50" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to {project.name}</h2>
                <p className="max-w-md text-sm">
                  Select a page or file from the explorer on the left to view or edit it. Right click on the explorer to create folders and resources.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
