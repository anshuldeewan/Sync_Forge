'use client';

import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Loading SyncForge...</p>
      </div>
    );
  }

  // Temporary public landing page until Phase 13
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-6 text-center">
      <div className="max-w-2xl space-y-8">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
            SF
          </div>
        </div>
        
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
          Build together, faster.
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-xl mx-auto">
          The premium developer collaboration platform. Manage workspaces, code, and resources in one unified interface.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
          <Link 
            href="/login" 
            className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Log in to SyncForge
          </Link>
          <Link 
            href="/signup" 
            className="inline-flex h-12 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
