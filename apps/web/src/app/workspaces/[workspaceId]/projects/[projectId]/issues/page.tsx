'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspace } from '../../../../../../context/WorkspaceContext';

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
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 p-6">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button 
              onClick={() => router.push(`/workspaces/${workspaceId}/projects/${projectId}`)}
              className="text-sm text-gray-500 hover:underline mb-2"
            >
              &larr; Back to Project
            </button>
            <h1 className="text-3xl font-bold">Issues - {project?.name || 'Project'}</h1>
          </div>
          <button
            onClick={() => openDialog()}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            New Issue
          </button>
        </div>

        {loading ? (
          <div>Loading issues...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['OPEN', 'IN_PROGRESS', 'CLOSED'].map(status => {
              const statusIssues = issues.filter(i => i.status === status);
              return (
                <div key={status} className="bg-gray-100 dark:bg-zinc-800 rounded-lg p-4 min-h-[500px]">
                  <h3 className="font-semibold text-lg mb-4 text-gray-700 dark:text-gray-300">
                    {status.replace('_', ' ')} ({statusIssues.length})
                  </h3>
                  <div className="space-y-4">
                    {statusIssues.map(issue => (
                      <div 
                        key={issue.id}
                        onClick={() => openDialog(issue)}
                        className="bg-white dark:bg-black p-4 rounded border border-gray-200 dark:border-zinc-700 shadow-sm cursor-pointer hover:border-blue-500 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium">{issue.title}</h4>
                          <span className={`text-xs px-2 py-1 rounded ${
                            issue.priority === 'HIGH' ? 'bg-red-100 text-red-800 dark:bg-red-900/30' : 
                            issue.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30' : 
                            'bg-green-100 text-green-800 dark:bg-green-900/30'
                          }`}>
                            {issue.priority}
                          </span>
                        </div>
                        {issue.linkedSnippet && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-mono bg-blue-50 dark:bg-blue-900/20 p-1 rounded inline-block truncate max-w-full">
                            Snippet: {issue.linkedSnippet.text}
                          </div>
                        )}
                        <div className="flex justify-between items-center text-xs text-gray-500 mt-4">
                          <span>By {issue.author.displayName}</span>
                          {issue.assignee && (
                            <span className="flex items-center gap-1">
                              <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[10px] text-blue-800">
                                {issue.assignee.displayName.charAt(0)}
                              </div>
                              {issue.assignee.displayName}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
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
    </div>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-lg w-full p-6">
        <h2 className="text-xl font-semibold mb-4">{issue?.id ? 'Edit Issue' : 'New Issue'}</h2>
        
        {error && <div className="text-red-500 mb-4 text-sm bg-red-50 p-2 rounded">{error}</div>}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="issue-title" className="block text-sm mb-1">Title</label>
            <input 
              id="issue-title"
              required
              disabled={isViewer}
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded bg-transparent" 
            />
          </div>
          <div>
            <label htmlFor="issue-desc" className="block text-sm mb-1">Description</label>
            <textarea 
              id="issue-desc"
              disabled={isViewer}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded bg-transparent h-24" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Status</label>
              <select 
                disabled={isViewer}
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded bg-transparent"
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Priority</label>
              <select 
                disabled={isViewer}
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded bg-transparent"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Assignee</label>
            <select 
              disabled={isViewer}
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded bg-transparent"
            >
              <option value="">Unassigned</option>
              {members.map(m => (
                <option key={m.userId} value={m.userId}>{m.user.displayName}</option>
              ))}
            </select>
          </div>

          {issue?.linkedSnippet && (
            <div className="bg-gray-50 dark:bg-zinc-800 p-3 rounded text-sm">
              <span className="block font-semibold mb-1">Linked Code</span>
              <div className="font-mono text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-900 p-2 rounded overflow-x-auto">
                {issue.linkedSnippet.text}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Resource: {issue.linkedSnippet.resourceId} | Version: {issue.linkedSnippet.version} <br />
                Lines: {issue.linkedSnippet.startLine}-{issue.linkedSnippet.endLine}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
            {!isViewer && (
              <button disabled={saving} type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Issue'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
