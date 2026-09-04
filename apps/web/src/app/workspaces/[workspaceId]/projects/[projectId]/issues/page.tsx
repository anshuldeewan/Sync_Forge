'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspace } from '../../../../../../context/WorkspaceContext';
import { AppShell } from '../../../../../../components/layout/AppShell';
import { PageHeader } from '../../../../../../components/layout/PageHeader';
import { Button } from '../../../../../../components/ui/button';
import { Card } from '../../../../../../components/ui/card';
import { Plus, GripVertical } from 'lucide-react';

export default function IssueBoardPage() {
  const { workspaceId, projectId } = useParams();
  const { fetchWithAuth, activeWorkspace } = useWorkspace();
  const router = useRouter();
  
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);

  const fetchIssues = async () => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/projects/${projectId}/issues`);
      if (res.ok) {
        const data = await res.json();
        const parsedIssues = data.issues.map((i: any) => ({
          ...i,
          linkedSnippet: typeof i.linkedSnippet === 'string' ? JSON.parse(i.linkedSnippet) : i.linkedSnippet
        }));
        setIssues(parsedIssues);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
    
    // Check for pending issue from Monaco editor
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('new') === 'true') {
      const pendingStr = sessionStorage.getItem('syncforge_pending_issue');
      if (pendingStr) {
        try {
          const linkedSnippet = JSON.parse(pendingStr);
          setSelectedIssue({ linkedSnippet });
          setShowDialog(true);
          sessionStorage.removeItem('syncforge_pending_issue');
          router.replace(`/workspaces/${workspaceId}/projects/${projectId}/issues`);
        } catch(e) {
          console.error(e);
        }
      } else {
        setShowDialog(true);
        router.replace(`/workspaces/${workspaceId}/projects/${projectId}/issues`);
      }
    }
  }, [workspaceId, projectId]);

  const openDialog = (issue: any = null) => {
    setSelectedIssue(issue);
    setShowDialog(true);
  };

  const closeDialog = (refresh = false) => {
    setShowDialog(false);
    setSelectedIssue(null);
    if (refresh) fetchIssues();
  };

  const project = activeWorkspace?.projects?.find(p => p.id === projectId);

  return (
    <AppShell>
      <div className="flex flex-col space-y-6 h-[calc(100vh-8rem)] animate-in fade-in duration-500">
        <PageHeader 
          title="Issues"
          description={project?.name}
          breadcrumbs={
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
               <a href={`/workspaces/${workspaceId}`} className="hover:underline">Workspace</a>
               <span>/</span>
               <a href={`/workspaces/${workspaceId}/projects/${projectId}`} className="hover:underline">{project?.name || 'Project'}</a>
               <span>/</span>
               <span className="text-foreground">Issues</span>
            </div>
          }
          actions={
            <Button onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              New Issue
            </Button>
          }
        />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-muted/30 rounded-xl p-4 animate-pulse">
                <div className="h-6 w-24 bg-muted mb-4 rounded"></div>
                <div className="space-y-3">
                   <div className="h-24 bg-muted rounded-md"></div>
                   <div className="h-24 bg-muted rounded-md"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden">
            {['OPEN', 'IN_PROGRESS', 'CLOSED'].map(status => {
              const statusIssues = issues.filter(i => i.status === status);
              return (
                <div key={status} className="bg-muted/30 rounded-xl p-4 flex flex-col h-full border border-border/50">
                  <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="font-semibold text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                      {status.replace('_', ' ')}
                      <span className="bg-background px-2 py-0.5 rounded-full text-xs border border-border shadow-sm">
                        {statusIssues.length}
                      </span>
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
                    {statusIssues.map(issue => (
                      <Card 
                        key={issue.id}
                        onClick={() => openDialog(issue)}
                        className="p-4 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all duration-200 group relative"
                      >
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                        <div className="flex justify-between items-start mb-2 pl-2">
                          <h4 className="font-medium text-sm leading-tight text-foreground line-clamp-2">{issue.title}</h4>
                        </div>
                        <div className="pl-2 mb-3">
                          <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            issue.priority === 'HIGH' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 
                            issue.priority === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 
                            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {issue.priority}
                          </span>
                        </div>
                        {issue.linkedSnippet && (
                          <div className="ml-2 text-[10px] text-primary/80 mb-3 font-mono bg-primary/10 p-1.5 rounded truncate border border-primary/20">
                            {issue.linkedSnippet.text}
                          </div>
                        )}
                        <div className="flex justify-between items-center text-xs text-muted-foreground mt-auto pt-2 border-t border-border/50 ml-2">
                          <span>{issue.author.displayName}</span>
                          {issue.assignee && (
                            <span className="flex items-center gap-1.5 bg-background border px-1.5 py-0.5 rounded-full shadow-sm">
                              <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[9px] text-primary font-bold">
                                {issue.assignee.displayName.charAt(0)}
                              </div>
                              <span className="text-[10px] font-medium">{issue.assignee.displayName.split(' ')[0]}</span>
                            </span>
                          )}
                        </div>
                      </Card>
                    ))}
                    {statusIssues.length === 0 && (
                      <div className="h-24 border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center text-xs text-muted-foreground/50">
                        Drop issues here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showDialog && (
        <IssueDialog 
          workspaceId={workspaceId as string}
          projectId={projectId as string}
          issue={selectedIssue} 
          onClose={() => closeDialog()} 
          onSave={() => closeDialog(true)} 
        />
      )}
    </AppShell>
  );
}

function IssueDialog({ workspaceId, projectId, issue, onClose, onSave }: any) {
  const { fetchWithAuth, myRole } = useWorkspace();
  const [title, setTitle] = useState(issue?.title || '');
  const [description, setDescription] = useState(issue?.description || '');
  const [status, setStatus] = useState(issue?.status || 'OPEN');
  const [priority, setPriority] = useState(issue?.priority || 'MEDIUM');
  const [assigneeId, setAssigneeId] = useState(issue?.assigneeId || '');
  const [members, setMembers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isViewer = myRole === 'VIEWER';

  useEffect(() => {
    fetchWithAuth(`/api/workspaces/${workspaceId}/members`)
      .then(r => r.json())
      .then(d => setMembers(d.members || []))
      .catch(e => console.error(e));
  }, [workspaceId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;
    setSaving(true);
    setError('');

    const url = issue?.id 
      ? `/api/workspaces/${workspaceId}/projects/${projectId}/issues/${issue.id}`
      : `/api/workspaces/${workspaceId}/projects/${projectId}/issues`;
    
    const method = issue?.id ? 'PATCH' : 'POST';

    try {
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          title, description, status, priority, assigneeId: assigneeId || null,
          linkedSnippet: issue?.linkedSnippet ? JSON.stringify(issue.linkedSnippet) : null
        })
      });
      if (res.ok) {
        onSave();
      } else {
        const d = await res.json();
        setError(d.error?.message || 'Failed to save');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground rounded-xl shadow-lg border max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">{issue?.id ? 'Edit Issue' : 'New Issue'}</h2>
        </div>
        
        <div className="p-6">
          {error && <div className="text-destructive bg-destructive/10 border border-destructive/20 mb-4 text-sm p-3 rounded-md">{error}</div>}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="issue-title" className="text-sm font-medium leading-none">Title</label>
              <input 
                id="issue-title"
                required
                disabled={isViewer}
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors" 
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="issue-desc" className="text-sm font-medium leading-none">Description</label>
              <textarea 
                id="issue-desc"
                disabled={isViewer}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-none" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Status</label>
                <select 
                  disabled={isViewer}
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Priority</label>
                <select 
                  disabled={isViewer}
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Assignee</label>
              <select 
                disabled={isViewer}
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                <option value="">Unassigned</option>
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>{m.user.displayName}</option>
                ))}
              </select>
            </div>

            {issue?.linkedSnippet && (
              <div className="bg-muted p-3 rounded-md text-sm border border-border">
                <span className="block font-semibold mb-2">Linked Code</span>
                <div className="font-mono text-xs text-muted-foreground bg-background p-2 rounded overflow-x-auto border border-border/50">
                  {issue.linkedSnippet.text}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Resource: {issue.linkedSnippet.resourceId} | Version: {issue.linkedSnippet.version} <br />
                  Lines: {issue.linkedSnippet.startLine}-{issue.linkedSnippet.endLine}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              {!isViewer && (
                <Button disabled={saving} type="submit">
                  {saving ? 'Saving...' : 'Save Issue'}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
