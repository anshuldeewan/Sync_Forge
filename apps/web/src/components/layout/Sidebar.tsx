'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { UserMenu } from './UserMenu';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderOpen,
  CheckSquare,
  FileText,
  Settings,
  Shield,
  History
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export function Sidebar() {
  const pathname = usePathname();
  const { activeWorkspace, myRole } = useWorkspace();
  const isPlatformAdmin = false; // TODO: Connect to real admin claim check

  const wsId = activeWorkspace?.id;
  const isWorkspaceContext = !!wsId;

  const globalNav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  ];

  const workspaceNav = [
    { name: 'Overview', href: `/workspaces/${wsId}`, icon: LayoutDashboard },
    { name: 'Projects', href: `/workspaces/${wsId}/projects`, icon: FolderOpen },
    { name: 'Issues', href: `/workspaces/${wsId}/issues`, icon: CheckSquare }, // Assuming future route
    { name: 'Settings', href: `/workspaces/${wsId}/settings`, icon: Settings },
    { name: 'Audit Logs', href: `/workspaces/${wsId}/settings/audit`, icon: History },
  ];

  const navToUse = isWorkspaceContext ? workspaceNav : globalNav;

  return (
    <aside className="hidden w-64 flex-col border-r bg-card text-card-foreground md:flex h-full">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <div className="h-6 w-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs">
            SF
          </div>
          <span>SyncForge</span>
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="space-y-1">
          <WorkspaceSwitcher />
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navToUse.map((item) => {
            if (!item.href.includes('undefined')) {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            }
            return null;
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1 pt-4">
          {/* Admin Link conditionally shown */}
          {isPlatformAdmin && (
            <Link
              href="/admin"
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/admin')
                  ? 'bg-destructive/10 text-destructive'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Shield className="h-4 w-4" />
              Platform Admin
            </Link>
          )}
        </div>
      </div>

      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <UserMenu />
          <div className="flex flex-col truncate">
             {/* Text is visually handled inside UserMenu for dropdown, but we can also add a hint here or leave it minimal. The UserMenu triggers the dropdown. */}
             <span className="text-sm font-medium">My Account</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
