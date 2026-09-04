'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsSidebar } from '@/components/workspace/SettingsSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Settings, Users, AlertCircle } from 'lucide-react';

export default function WorkspaceSettings() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as string;
  const currentTab = searchParams?.get('tab') || 'general';
  
  const { user, isDemo } = useAuth();
  const { activeWorkspace, myRole, fetchWithAuth, refreshWorkspaces } = useWorkspace();
  const router = useRouter();
  
  // Data states
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  
  // Form states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EDITOR');
  const [workspaceName, setWorkspaceName] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const canManageSettings = myRole === 'OWNER' || myRole === 'ADMIN';
  const canDeleteWorkspace = myRole === 'OWNER';

  const loadData = async () => {
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetchWithAuth(`/api/workspaces/${workspaceId}/members`),
        fetchWithAuth(`/api/workspaces/${workspaceId}/invitations`)
      ]);

      if (membersRes?.ok) {
        const data = await membersRes.json();
        setMembers(data.members);
      }
      if (invitesRes?.ok) {
        const data = await invitesRes.json();
        setInvitations(data.invitations);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && activeWorkspace) {
      if (activeWorkspace.id !== workspaceId) {
        router.push('/');
      } else {
        setWorkspaceName(activeWorkspace.name);
        loadData();
      }
    }
  }, [user, activeWorkspace, workspaceId, router]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) return;
    if (isDemo) {
      alert('This action is disabled in the Demo Sandbox.');
      return;
    }
    
    setActionLoading(true);
    setSuccess('');
    setInviteLink('');
    setActionLoading(true);

    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error?.message || 'Failed to invite');

      setSuccess('Invitation created successfully!');
      setInviteLink(data.inviteUrl);
      setInviteEmail('');
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!canManageSettings) return;
    if (isDemo) {
      alert('This action is disabled in the Demo Sandbox.');
      return;
    }
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error?.message || 'Failed to remove member');
        return;
      }
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) return;
    if (isDemo) {
      alert('This action is disabled in the Demo Sandbox.');
      return;
    }
    if (workspaceName.trim() === activeWorkspace?.name) return;
    
    setError('');
    setSuccess('');
    setActionLoading(true);

    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: workspaceName })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error?.message || 'Failed to rename workspace');

      setSuccess('Workspace renamed successfully!');
      await refreshWorkspaces();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!canDeleteWorkspace) return;
    if (isDemo) {
      setIsDeleteDialogOpen(false);
      alert('This action is disabled in the Demo Sandbox.');
      return;
    }
    if (deleteConfirmName !== activeWorkspace?.name) return;
    
    setActionLoading(true);
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to delete workspace');
      }

      await refreshWorkspaces();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
      setActionLoading(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (!activeWorkspace || loading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER': return <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/30 border-transparent">Owner</Badge>;
      case 'ADMIN': return <Badge variant="default" className="bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 border-transparent">Admin</Badge>;
      case 'EDITOR': return <Badge variant="secondary">Editor</Badge>;
      case 'VIEWER': return <Badge variant="outline">Viewer</Badge>;
      default: return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col space-y-6 animate-in fade-in duration-500 p-6 md:p-8 max-w-7xl mx-auto w-full">
        <PageHeader 
          title="Settings" 
          breadcrumbs={
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-foreground">{activeWorkspace.name}</span>
              <span>/</span>
              <span>Settings</span>
            </div>
          }
        />
        
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0 mt-6">
          <aside className="lg:w-1/5">
            <SettingsSidebar workspaceId={workspaceId} />
          </aside>
          
          <div className="flex-1 lg:max-w-4xl space-y-8">
            {error && (
              <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            
            {success && (
              <div className="flex items-center gap-2 p-4 text-sm text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {success}
              </div>
            )}

            {currentTab === 'general' && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h3 className="text-lg font-medium">General Settings</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage your workspace name and preferences.
                  </p>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Workspace Name</CardTitle>
                      <CardDescription>
                        This is your workspace's visible name within SyncForge.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleRename} className="flex gap-4 max-w-md">
                        <Input
                          value={workspaceName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWorkspaceName(e.target.value)}
                          disabled={!canManageSettings || actionLoading}
                          placeholder="Workspace Name"
                        />
                        {canManageSettings && (
                          <Button 
                            type="submit" 
                            disabled={workspaceName.trim() === activeWorkspace.name || actionLoading}
                          >
                            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save
                          </Button>
                        )}
                      </form>
                    </CardContent>
                  </Card>
                </div>

                {canDeleteWorkspace && (
                  <div>
                    <h3 className="text-lg font-medium text-destructive">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Irreversible and destructive actions.
                    </p>
                    
                    <Card className="border-destructive/20 bg-destructive/5">
                      <CardHeader>
                        <CardTitle className="text-destructive">Delete Workspace</CardTitle>
                        <CardDescription>
                          Once you delete a workspace, there is no going back. Please be certain.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="destructive">Delete Workspace</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Are you absolutely sure?</DialogTitle>
                              <DialogDescription>
                                This action cannot be undone. This will permanently delete the
                                <strong> {activeWorkspace.name} </strong> workspace and remove all
                                projects, resources, and data associated with it.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="my-4 space-y-4">
                              <p className="text-sm font-medium">
                                Please type <span className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">{activeWorkspace.name}</span> to confirm.
                              </p>
                              <Input 
                                value={deleteConfirmName} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeleteConfirmName(e.target.value)}
                                placeholder={activeWorkspace.name}
                              />
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={actionLoading}>Cancel</Button>
                              <Button 
                                variant="destructive" 
                                onClick={handleDeleteWorkspace} 
                                disabled={deleteConfirmName !== activeWorkspace.name || actionLoading}
                              >
                                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Delete Workspace
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {currentTab === 'members' && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h3 className="text-lg font-medium">Members</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage who has access to this workspace.
                  </p>
                  
                  <Card>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {members.map((m) => (
                            <TableRow key={m.userId} className="group">
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                      {m.user.displayName?.substring(0, 2).toUpperCase() || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium leading-none mb-1">{m.user.displayName}</span>
                                    <span className="text-xs text-muted-foreground">{m.user.email}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {getRoleBadge(m.role)}
                              </TableCell>
                              <TableCell className="text-right">
                                {m.userId !== user?.uid && canManageSettings && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => removeMember(m.userId)}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    Remove
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                </div>

                {canManageSettings && (
                  <div>
                    <h3 className="text-lg font-medium">Invite Members</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Invite new people to collaborate in this workspace.
                    </p>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Send Invitation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {inviteLink && (
                          <div className="bg-primary/10 text-primary p-3 rounded-md mb-6 text-sm font-mono overflow-auto whitespace-nowrap border border-primary/20">
                            Share this link: {inviteLink}
                          </div>
                        )}
                        <form onSubmit={handleInvite} className="flex gap-4">
                          <Input 
                            type="email" 
                            placeholder="Email address" 
                            value={inviteEmail} 
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(e.target.value)}
                            className="flex-1"
                            required
                            disabled={actionLoading}
                          />
                          <select 
                            value={inviteRole} 
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInviteRole(e.target.value)}
                            className="h-9 w-[130px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={actionLoading}
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="EDITOR">Editor</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                          <Button type="submit" disabled={actionLoading}>
                            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Invite
                          </Button>
                        </form>
                      </CardContent>
                      
                      {invitations.length > 0 && (
                        <>
                          <Separator />
                          <CardContent className="pt-6">
                            <h4 className="text-sm font-medium mb-4">Pending Invitations</h4>
                            <div className="space-y-3">
                              {invitations.map(inv => (
                                <div key={inv.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/40">
                                  <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium">{inv.email}</span>
                                      <span className="text-xs text-muted-foreground">Expires: {new Date(inv.expiresAt).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                  {getRoleBadge(inv.role)}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </>
                      )}
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
