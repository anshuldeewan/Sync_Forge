'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../context/AuthContext';
import { useWorkspace } from '../../../../../context/WorkspaceContext';
import { AppShell } from '../../../../../components/layout/AppShell';
import { PageHeader } from '../../../../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';

export default function NewProject() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { refreshWorkspaces, activeWorkspace } = useWorkspace();
  
  const workspaceId = params.workspaceId as string;

  if (activeWorkspace?.id !== workspaceId) {
    // Rely on the outer page layout or effects to manage this ideally, 
    // but if mismatch, redirect appropriately.
    router.push(`/workspaces/${workspaceId}`);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const token = await user?.getIdToken();
      const { getApiUrl } = await import('../../../../../config/api');
      const apiUrl = getApiUrl();

      const res = await fetch(`${apiUrl}/api/workspaces/${workspaceId}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to create project');
      }

      await refreshWorkspaces();
      router.push(`/workspaces/${workspaceId}`); // Fixed redirect
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
        <PageHeader 
          title="New Project" 
          description="Create a new project within your workspace." 
        />
        
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm border border-destructive/20">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label htmlFor="projectName" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Project Name
                </label>
                <input
                  id="projectName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors hover:border-primary/50"
                  placeholder="e.g. Q3 Roadmap"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/workspaces/${workspaceId}`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !name.trim()}
              >
                {loading ? 'Creating...' : 'Create Project'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
