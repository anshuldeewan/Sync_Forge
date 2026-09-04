'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsSidebar } from '@/components/workspace/SettingsSidebar';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Download, Search, Maximize2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function WorkspaceAuditLogs() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { user } = useAuth();
  const { activeWorkspace, fetchWithAuth } = useWorkspace();
  const router = useRouter();
  
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(20);
  
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Metadata Modal
  const [selectedMetadata, setSelectedMetadata] = useState<any>(null);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      
      if (search) queryParams.append('search', search);
      if (actionFilter) queryParams.append('action', actionFilter);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/audit?${queryParams.toString()}`);
      if (!res) return;
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to load audit logs');
      }
      
      setLogs(data.auditLogs || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && activeWorkspace) {
      if (activeWorkspace.id !== workspaceId) {
        router.push('/');
      } else {
        loadLogs();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeWorkspace, workspaceId, router, page, search, actionFilter, startDate, endDate]);

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    
    const headers = ['Timestamp', 'Actor Name', 'Actor Email', 'Action', 'Resource', 'Metadata'];
    const rows = logs.map(log => [
      new Date(log.createdAt).toISOString(),
      log.user?.displayName || 'System',
      log.user?.email || '',
      log.action,
      log.resource,
      log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => `"${e.join('","')}"`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_logs_${workspaceId}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openMetadata = (metadata: any) => {
    setSelectedMetadata(metadata);
    setIsMetadataOpen(true);
  };

  // Handle unauthorized view
  if (error && error.toLowerCase().includes('permission')) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">
              You do not have permission to view audit logs for this workspace. Only Workspace Admins and Owners can access this page.
            </p>
          </div>
          <Button onClick={() => router.push(`/workspaces/${workspaceId}/settings`)}>
            Return to Settings
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!activeWorkspace) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const getActionBadge = (action: string) => {
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes('CREATE')) return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-transparent">{action}</Badge>;
    if (actionUpper.includes('DELETE') || actionUpper.includes('REMOVE')) return <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-transparent">{action}</Badge>;
    if (actionUpper.includes('UPDATE')) return <Badge variant="default" className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-transparent">{action}</Badge>;
    return <Badge variant="secondary">{action}</Badge>;
  };

  return (
    <AppShell>
      <div className="flex flex-col space-y-6 animate-in fade-in duration-500 p-6 md:p-8 max-w-7xl mx-auto w-full">
        <PageHeader 
          title="Audit Logs" 
          breadcrumbs={
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-foreground">{activeWorkspace.name}</span>
              <span>/</span>
              <span className="cursor-pointer hover:underline" onClick={() => router.push(`/workspaces/${workspaceId}/settings`)}>Settings</span>
              <span>/</span>
              <span>Audit Logs</span>
            </div>
          }
          actions={
            <Button 
              variant="outline" 
              onClick={handleExportCSV} 
              disabled={logs.length === 0 || loading}
              className="active:scale-95 transition-transform"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          }
        />
        
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0 mt-6">
          <aside className="lg:w-1/5">
            <SettingsSidebar workspaceId={workspaceId} />
          </aside>
          
          <div className="flex-1 lg:max-w-5xl space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div>
              <h3 className="text-lg font-medium">Audit Trail</h3>
              <p className="text-sm text-muted-foreground mb-4">
                A detailed record of all actions performed in this workspace.
              </p>
              
              {error && !error.toLowerCase().includes('permission') && (
                <div className="flex items-center gap-2 p-4 mb-4 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Card>
                {/* Filters Toolbar */}
                <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto flex-1">
                    <div className="relative flex-1 sm:max-w-xs">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search resource or actor..."
                        className="pl-9 h-9"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1); // Reset to first page on new search
                        }}
                      />
                    </div>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={actionFilter}
                      onChange={(e) => {
                        setActionFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All Actions</option>
                      <option value="CREATE">Creates</option>
                      <option value="UPDATE">Updates</option>
                      <option value="DELETE">Deletes</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex flex-col gap-1 w-full sm:w-32">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase px-1">Start Date</span>
                      <Input 
                        type="date" 
                        className="h-9 text-xs" 
                        value={startDate} 
                        onChange={e => { setStartDate(e.target.value); setPage(1); }} 
                      />
                    </div>
                    <div className="flex flex-col gap-1 w-full sm:w-32">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase px-1">End Date</span>
                      <Input 
                        type="date" 
                        className="h-9 text-xs" 
                        value={endDate} 
                        onChange={e => { setEndDate(e.target.value); setPage(1); }} 
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Timestamp</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Target Resource</TableHead>
                        <TableHead className="w-[200px]">Metadata</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                          </TableRow>
                        ))
                      ) : logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-40 text-center">
                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                              <Search className="h-10 w-10 mb-4 opacity-20" />
                              <p>No audit logs found matching your filters.</p>
                              {(search || actionFilter || startDate || endDate) && (
                                <Button 
                                  variant="link" 
                                  onClick={() => {
                                    setSearch('');
                                    setActionFilter('');
                                    setStartDate('');
                                    setEndDate('');
                                  }}
                                >
                                  Clear Filters
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.map(log => (
                          <TableRow key={log.id} className="group hover:bg-muted/50 transition-colors">
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
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
                                    <span className="text-sm font-medium leading-none mb-1 truncate max-w-[150px]">{log.user.displayName}</span>
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{log.user.email}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground italic">System / Unknown</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {getActionBadge(log.action)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]" title={log.resource}>
                              {log.resource}
                            </TableCell>
                            <TableCell>
                              {log.metadata ? (
                                <div 
                                  className="group/meta relative cursor-pointer"
                                  onClick={() => openMetadata(log.metadata)}
                                >
                                  <div className="text-[10px] bg-muted/50 p-2 rounded-md overflow-hidden text-ellipsis whitespace-nowrap font-mono max-w-[200px] border border-transparent group-hover/meta:border-primary/20 transition-colors">
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
                
                {/* Pagination */}
                {!loading && logs.length > 0 && (
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
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
      
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
    </AppShell>
  );
}
