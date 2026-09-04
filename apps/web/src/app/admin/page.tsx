'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Skeleton } from '../../components/ui/skeleton';
import { AlertCircle, ChevronLeft, ChevronRight, Users, Building, HardDrive, LayoutDashboard, Maximize2, Shield, Search } from 'lucide-react';

type Tab = 'stats' | 'users' | 'workspaces' | 'audit';

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = (searchParams?.get('tab') as Tab) || 'stats';
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(20);
  
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [selectedMetadata, setSelectedMetadata] = useState<any>(null);

  const fetchWithAuth = async (url: string) => {
    if (!user) return null;
    const token = await user.getIdToken();
    const { getApiUrl } = await import('../../config/api');
    return fetch(`${getApiUrl()}${url}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  };

  const loadData = async (tab: Tab, pageNum: number) => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'stats') {
        const res = await fetchWithAuth('/api/admin/stats');
        if (res && res.ok) {
          const data = await res.json();
          setStats(data.stats);
        } else {
          throw new Error('Failed to load stats');
        }
      } else if (tab === 'users') {
        const res = await fetchWithAuth(`/api/admin/users?page=${pageNum}&limit=${limit}`);
        if (res && res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
          setTotalPages(data.pagination?.totalPages || 1);
        } else {
          throw new Error('Failed to load users');
        }
      } else if (tab === 'workspaces') {
        const res = await fetchWithAuth(`/api/admin/workspaces?page=${pageNum}&limit=${limit}`);
        if (res && res.ok) {
          const data = await res.json();
          setWorkspaces(data.workspaces || []);
          setTotalPages(data.pagination?.totalPages || 1);
        } else {
          throw new Error('Failed to load workspaces');
        }
      } else if (tab === 'audit') {
        const res = await fetchWithAuth(`/api/admin/audit?page=${pageNum}&limit=${limit}`);
        if (res && res.ok) {
          const data = await res.json();
          setAuditLogs(data.auditLogs || []);
          setTotalPages(data.pagination?.totalPages || 1);
        } else {
          throw new Error('Failed to load global audit logs');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred fetching admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData(currentTab, page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentTab, page]);

  useEffect(() => {
    setPage(1); // Reset page on tab change
  }, [currentTab]);

  const openMetadata = (metadata: any) => {
    setSelectedMetadata(metadata);
    setIsMetadataOpen(true);
  };

  const getActionBadge = (action: string) => {
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes('CREATE')) return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-transparent">{action}</Badge>;
    if (actionUpper.includes('DELETE') || actionUpper.includes('REMOVE')) return <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-transparent">{action}</Badge>;
    if (actionUpper.includes('UPDATE')) return <Badge variant="default" className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-transparent">{action}</Badge>;
    return <Badge variant="secondary">{action}</Badge>;
  };

  const getTabTitle = () => {
    switch (currentTab) {
      case 'stats': return 'Overview';
      case 'users': return 'Users Management';
      case 'workspaces': return 'Workspaces Directory';
      case 'audit': return 'Global Audit Trail';
      default: return 'Platform Admin';
    }
  };

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500 w-full">
      <PageHeader 
        title={getTabTitle()} 
        breadcrumbs={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-foreground">Platform Admin</span>
            <span>/</span>
            <span>{getTabTitle()}</span>
          </div>
        }
      />

      {error && (
        <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-md">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* STATS VIEW */}
      {currentTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          {loading && !stats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))
          ) : stats ? (
            <>
              <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.users.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Registered accounts across platform</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Workspaces</CardTitle>
                  <Building className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.workspaces.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Active collaborative environments</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
                  <LayoutDashboard className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.projects.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Projects managed platform-wide</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Resources</CardTitle>
                  <HardDrive className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.resources.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Files and pages created</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* USERS VIEW */}
      {currentTab === 'users' && (
        <Card className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Privileges</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && users.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell align="right"><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">No users found.</TableCell>
                  </TableRow>
                ) : (
                  users.map(u => (
                    <TableRow key={u.id} className="group hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {u.displayName?.substring(0, 2).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium leading-none mb-1">{u.displayName}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{u.id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.isPlatformAdmin ? (
                          <Badge variant="default" className="bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-transparent">
                            <Shield className="h-3 w-3 mr-1" /> Admin
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">User</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {renderPagination()}
        </Card>
      )}

      {/* WORKSPACES VIEW */}
      {currentTab === 'workspaces' && (
        <Card className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && workspaces.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell align="right"><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : workspaces.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No workspaces found.</TableCell>
                  </TableRow>
                ) : (
                  workspaces.map(w => (
                    <TableRow key={w.id} className="group hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{w.id}</TableCell>
                      <TableCell className="text-sm">{w._count?.members || 0}</TableCell>
                      <TableCell className="text-sm">{w._count?.projects || 0}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(w.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {w.isDeleted ? (
                          <Badge variant="destructive" className="bg-destructive/10 text-destructive border-transparent">Deleted</Badge>
                        ) : (
                          <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-transparent">Active</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {renderPagination()}
        </Card>
      )}

      {/* GLOBAL AUDIT LOGS VIEW */}
      {currentTab === 'audit' && (
        <Card className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Timestamp</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target Resource</TableHead>
                  <TableHead className="w-[150px]">Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && auditLogs.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : auditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No global audit logs found.</TableCell>
                  </TableRow>
                ) : (
                  auditLogs.map(log => (
                    <TableRow key={log.id} className="group hover:bg-muted/50 transition-colors">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        {log.workspace ? (
                          <span className="text-sm font-medium truncate max-w-[150px] inline-block">{log.workspace.name}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Global / System</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.user ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {log.user.displayName?.substring(0, 2).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium leading-none mb-1 truncate max-w-[120px]">{log.user.displayName}</span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{log.user.email}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getActionBadge(log.action)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[150px]" title={log.resource}>
                        {log.resource}
                      </TableCell>
                      <TableCell>
                        {log.metadata ? (
                          <div 
                            className="group/meta relative cursor-pointer"
                            onClick={() => openMetadata(log.metadata)}
                          >
                            <div className="text-[10px] bg-muted/50 p-2 rounded-md overflow-hidden text-ellipsis whitespace-nowrap font-mono max-w-[150px] border border-transparent group-hover/meta:border-primary/20 transition-colors">
                              {JSON.stringify(log.metadata)}
                            </div>
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-background/80 backdrop-blur rounded shadow-sm opacity-0 group-hover/meta:opacity-100 transition-opacity">
                              <Maximize2 className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {renderPagination()}
        </Card>
      )}

      {/* Metadata Modal */}
      <Dialog open={isMetadataOpen} onOpenChange={setIsMetadataOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Metadata Details</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto mt-4 bg-zinc-950 p-4 rounded-md">
            <pre className="text-xs font-mono text-zinc-50 whitespace-pre-wrap">
              {selectedMetadata ? JSON.stringify(selectedMetadata, null, 2) : ''}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderPagination() {
    if (loading || totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
        <div className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next</span>
          </Button>
        </div>
      </div>
    );
  }
}
