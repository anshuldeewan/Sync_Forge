'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Settings, Users, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useWorkspace } from '../../context/WorkspaceContext';

export function SettingsSidebar({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { myRole } = useWorkspace();
  const currentTab = searchParams?.get('tab') || 'general';

  const navItems = [
    {
      name: 'General',
      href: `/workspaces/${workspaceId}/settings?tab=general`,
      icon: Settings,
      isActive: pathname === `/workspaces/${workspaceId}/settings` && currentTab === 'general',
      roles: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']
    },
    {
      name: 'Members',
      href: `/workspaces/${workspaceId}/settings?tab=members`,
      icon: Users,
      isActive: pathname === `/workspaces/${workspaceId}/settings` && currentTab === 'members',
      roles: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']
    },
    {
      name: 'Audit Logs',
      href: `/workspaces/${workspaceId}/settings/audit`,
      icon: Activity,
      isActive: pathname === `/workspaces/${workspaceId}/settings/audit`,
      roles: ['OWNER', 'ADMIN']
    }
  ];

  return (
    <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
      {navItems.map((item) => {
        // If myRole exists and it's not in roles, don't show
        if (myRole && !item.roles.includes(myRole)) {
          return null;
        }

        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "active:scale-[0.98]",
              item.isActive
                ? "bg-secondary text-secondary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
