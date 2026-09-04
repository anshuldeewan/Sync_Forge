'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

type Tab = 'stats' | 'users' | 'workspaces' | 'audit';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('stats');

  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Pagination (simplified for this view, using page 1, could be expanded)
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    if (!user) return null;
    const token = await user.getIdToken();
    const { getApiUrl } = await import('../../config/api');
    const apiUrl = getApiUrl();
    return fetch(`${apiUrl}${url}`, {
      ...options,
      headers: { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
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
      loadData(activeTab, page);
    }
  }, [user, activeTab, page]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setPage(1);
    setTotalPages(1);
  };

  const tabs: { id: Tab, label: string }[] = [
    { id: 'stats', label: 'Overview & Stats' },
    { id: 'users', label: 'Users' },
    { id: 'workspaces', label: 'Workspaces' },
    { id: 'audit', label: 'Global Audit Logs' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex border-b border-gray-200 dark:border-zinc-800 gap-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={`pb-3 font-medium text-sm transition-colors relative ${
              activeTab === t.id 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
            {activeTab === t.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-md" />
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100">{error}</div>
      )}

      {/* STATS VIEW */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading && !stats ? (
            <div className="col-span-full text-gray-500 py-12 text-center">Loading system statistics...</div>
          ) : stats ? (
            <>
              <StatCard title="Total Users" value={stats.users} />
              <StatCard title="Total Workspaces" value={stats.workspaces} />
              <StatCard title="Total Projects" value={stats.projects} />
              <StatCard title="Total Resources" value={stats.resources} />
            </>
          ) : null}
        </div>
      )}

      {/* USERS VIEW */}
      {activeTab === 'users' && (
        <DataTable 
          loading={loading} 
          page={page} 
          totalPages={totalPages} 
          setPage={setPage}
          columns={['ID', 'Name', 'Email', 'Joined', 'Platform Admin']}
        >
          {users.map(u => (
            <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
              <td className="py-3 px-4 font-mono text-xs text-gray-500">{u.id}</td>
              <td className="py-3 px-4 font-medium">{u.displayName}</td>
              <td className="py-3 px-4">{u.email}</td>
              <td className="py-3 px-4 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
              <td className="py-3 px-4">
                {u.isPlatformAdmin ? (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded text-xs font-semibold">Admin</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
          {users.length === 0 && !loading && <EmptyRow colSpan={5} message="No users found." />}
        </DataTable>
      )}

      {/* WORKSPACES VIEW */}
      {activeTab === 'workspaces' && (
        <DataTable 
          loading={loading} 
          page={page} 
          totalPages={totalPages} 
          setPage={setPage}
          columns={['ID', 'Name', 'Members', 'Projects', 'Created', 'Status']}
        >
          {workspaces.map(w => (
            <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
              <td className="py-3 px-4 font-mono text-xs text-gray-500">{w.id}</td>
              <td className="py-3 px-4 font-medium">{w.name}</td>
              <td className="py-3 px-4">{w._count?.members || 0}</td>
              <td className="py-3 px-4">{w._count?.projects || 0}</td>
              <td className="py-3 px-4 text-gray-500">{new Date(w.createdAt).toLocaleDateString()}</td>
              <td className="py-3 px-4">
                {w.isDeleted ? (
                  <span className="text-red-500 text-xs">Deleted</span>
                ) : (
                  <span className="text-green-500 text-xs">Active</span>
                )}
              </td>
            </tr>
          ))}
          {workspaces.length === 0 && !loading && <EmptyRow colSpan={6} message="No workspaces found." />}
        </DataTable>
      )}

      {/* AUDIT LOGS VIEW */}
      {activeTab === 'audit' && (
        <DataTable 
          loading={loading} 
          page={page} 
          totalPages={totalPages} 
          setPage={setPage}
          columns={['Timestamp', 'Workspace', 'Actor', 'Action', 'Resource', 'Metadata']}
        >
          {auditLogs.map(log => (
            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
              <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-500">
                {new Date(log.createdAt).toLocaleString()}
              </td>
              <td className="py-3 px-4">
                {log.workspace ? (
                  <div className="font-medium">{log.workspace.name}</div>
                ) : (
                  <span className="text-gray-400 italic">Global/System</span>
                )}
              </td>
              <td className="py-3 px-4">
                {log.user ? (
                  <div>
                    <div className="font-medium text-sm">{log.user.displayName}</div>
                    <div className="text-xs text-gray-500">{log.user.email}</div>
                  </div>
                ) : (
                  <span className="text-gray-400 italic text-sm">Unknown</span>
                )}
              </td>
              <td className="py-3 px-4 font-medium">
                <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded text-xs">
                  {log.action}
                </span>
              </td>
              <td className="py-3 px-4 font-mono text-xs text-gray-500 max-w-[120px] truncate" title={log.resource}>
                {log.resource}
              </td>
              <td className="py-3 px-4">
                {log.metadata ? (
                  <pre className="text-[10px] bg-gray-50 dark:bg-zinc-900 p-2 rounded overflow-x-auto max-w-[200px]">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                ) : (
                  <span className="text-gray-400 italic">-</span>
                )}
              </td>
            </tr>
          ))}
          {auditLogs.length === 0 && !loading && <EmptyRow colSpan={6} message="No global audit logs found." />}
        </DataTable>
      )}
    </div>
  );
}

// Subcomponents for cleaner layout

function StatCard({ title, value }: { title: string, value: number | string }) {
  return (
    <div className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg p-6 flex flex-col shadow-sm">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{title}</span>
      <span className="text-3xl font-bold">{value.toLocaleString()}</span>
    </div>
  );
}

function DataTable({ 
  loading, 
  page, 
  totalPages, 
  setPage, 
  columns, 
  children 
}: { 
  loading: boolean; 
  page: number; 
  totalPages: number; 
  setPage: (p: any) => void; 
  columns: string[]; 
  children: React.ReactNode 
}) {
  return (
    <div className="bg-white dark:bg-black rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-800 border-b dark:border-zinc-800">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className="py-3 px-4 font-semibold">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-gray-500">Loading data...</td>
              </tr>
            ) : children}
          </tbody>
        </table>
      </div>
      
      {!loading && totalPages > 0 && (
        <div className="border-t dark:border-zinc-800 p-4 flex items-center justify-between bg-gray-50 dark:bg-zinc-900/50">
          <div className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button 
              disabled={page <= 1}
              onClick={() => setPage((p: number) => Math.max(1, p - 1))}
              className="px-3 py-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Previous
            </button>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage((p: number) => p + 1)}
              className="px-3 py-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-gray-500">{message}</td>
    </tr>
  );
}
