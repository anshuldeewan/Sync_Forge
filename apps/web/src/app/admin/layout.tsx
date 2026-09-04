'use client';

import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        // Verify via API to ensure we don't trust frontend flags
        const checkAdmin = async () => {
          try {
            const token = await user.getIdToken();
            const { getApiUrl } = await import('../../config/api');
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/api/admin/stats`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          } catch (e) {
            setIsAdmin(false);
          }
        };
        checkAdmin();
      }
    }
  }, [user, loading, router]);

  if (loading || isAdmin === null) {
    return <div className="p-8 flex justify-center text-gray-500">Loading admin environment...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-8 flex justify-center items-center min-h-screen bg-gray-50 dark:bg-zinc-900">
        <div className="text-center p-8 bg-white dark:bg-black rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">You must be a platform administrator to view this area.</p>
          <button 
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-zinc-800 p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-blue-600">SyncForge</span>
            <span className="text-gray-400">/</span>
            <span>Platform Admin</span>
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user?.email}</span>
            <button onClick={() => router.push('/')} className="text-sm bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded transition-colors">
              Exit Admin
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
