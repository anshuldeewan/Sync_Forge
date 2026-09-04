import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface AuthLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function AuthLayout({ children, className, ...props }: AuthLayoutProps) {
  return (
    <div 
      className={cn(
        "min-h-screen grid lg:grid-cols-2 bg-background",
        className
      )}
      {...props}
    >
      {/* Left side - Product context / Branding */}
      <div className="hidden lg:flex flex-col justify-between border-r bg-muted/30 p-12">
        <div className="flex items-center gap-2 font-bold tracking-tight text-xl">
          <div className="h-8 w-8 rounded bg-primary text-primary-foreground flex items-center justify-center text-sm">
            SF
          </div>
          <span>SyncForge</span>
        </div>
        
        <div className="space-y-6 max-w-md">
          <h1 className="text-4xl font-bold tracking-tight">
            Build together, faster.
          </h1>
          <p className="text-lg text-muted-foreground">
            The premium developer collaboration platform. Manage workspaces, code, and resources in one unified interface.
          </p>
        </div>
        
        <div className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SyncForge. All rights reserved.
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-24">
        {/* Mobile Logo */}
        <div className="lg:hidden flex items-center gap-2 font-bold tracking-tight text-xl mb-12">
          <div className="h-8 w-8 rounded bg-primary text-primary-foreground flex items-center justify-center text-sm">
            SF
          </div>
          <span>SyncForge</span>
        </div>
        
        <div className="mx-auto w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
