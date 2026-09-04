'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../context/AuthContext';
import { useWorkspace } from '../../../../context/WorkspaceContext';

export default function WorkspaceSettings() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const router = useRouter();
  
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EDITOR');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    if (!user) return null;
    const token = await user.getIdToken();
    const { getApiUrl } = await import('../../../../config/api');
    const apiUrl = getApiUrl();
    return fetch(`${apiUrl}${url}`, {
      ...options,
      headers: { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
  };

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
        loadData();
      }
    }
  }, [user, activeWorkspace, workspaceId, router]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviteLink('');

    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const data = await res!.json();

      if (!res!.ok) throw new Error(data.error?.message || 'Failed to invite');

      setSuccess('Invitation created!');
      setInviteLink(data.inviteUrl);
      setInviteEmail('');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeMember = async (userId: string) => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' });
      if (!res!.ok) {
        const data = await res!.json();
        alert(data.error?.message || 'Failed to remove member');
        return;
      }
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 p-8">
      <div className="max-w-4xl mx-auto w-full">
        <button onClick={() => router.push('/')} className="text-blue-500 hover:underline mb-6">&larr; Back to Dashboard</button>
        
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Workspace Settings</h1>
          <button 
            onClick={() => router.push(`/workspaces/${workspaceId}/settings/audit`)} 
            className="bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            View Audit Logs
          </button>
        </div>

        <div className="bg-white dark:bg-black rounded-lg p-6 shadow-sm border border-gray-200 dark:border-zinc-800 mb-8">
          <h2 className="text-xl font-semibold mb-4">Members</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b dark:border-zinc-800">
                <th className="py-2">User</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.userId} className="border-b dark:border-zinc-800">
                  <td className="py-3">
                    <div>{m.user.displayName}</div>
                    <div className="text-sm text-gray-500">{m.user.email}</div>
                  </td>
                  <td>{m.role}</td>
                  <td>
                    {m.userId !== user?.uid && (
                      <button onClick={() => removeMember(m.userId)} className="text-red-500 hover:underline text-sm">Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white dark:bg-black rounded-lg p-6 shadow-sm border border-gray-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold mb-4">Invite New Member</h2>
          
          {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
          {success && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{success}</div>}
          {inviteLink && (
            <div className="bg-blue-50 text-blue-800 p-3 rounded mb-4 text-sm font-mono overflow-auto whitespace-nowrap">
              Share this link: {inviteLink}
            </div>
          )}

          <form onSubmit={handleInvite} className="flex gap-4">
            <input 
              type="email" 
              placeholder="Email address" 
              value={inviteEmail} 
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1 p-2 border border-gray-300 dark:border-zinc-700 rounded bg-transparent"
              required
            />
            <select 
              value={inviteRole} 
              onChange={e => setInviteRole(e.target.value)}
              className="p-2 border border-gray-300 dark:border-zinc-700 rounded bg-transparent"
            >
              <option value="ADMIN">Admin</option>
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Invite</button>
          </form>

          <h3 className="font-semibold mt-8 mb-2">Pending Invitations</h3>
          {invitations.length === 0 ? <p className="text-gray-500 text-sm">No pending invitations.</p> : (
            <ul className="space-y-2">
              {invitations.map(inv => (
                <li key={inv.id} className="text-sm border p-3 rounded flex justify-between dark:border-zinc-700">
                  <span>{inv.email} ({inv.role})</span>
                  <span className="text-gray-500">Expires: {new Date(inv.expiresAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
