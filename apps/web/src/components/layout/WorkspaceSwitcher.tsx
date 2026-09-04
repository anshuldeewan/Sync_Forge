'use client';

import * as React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useRouter, useParams } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Check, ChevronsUpDown, Plus, Briefcase } from 'lucide-react';

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, switchWorkspace, loading } = useWorkspace();
  const router = useRouter();

  const handleSelect = (id: string) => {
    switchWorkspace(id);
    router.push(`/workspaces/${id}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          disabled={loading}
        >
          <div className="flex items-center gap-2 truncate">
            <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {loading
                ? 'Loading...'
                : activeWorkspace?.name || 'Select Workspace'}
            </span>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => handleSelect(workspace.id)}
            className="flex items-center justify-between"
          >
            <span className="truncate">{workspace.name}</span>
            {activeWorkspace?.id === workspace.id && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
        {workspaces.length === 0 && !loading && (
          <div className="py-2 text-center text-sm text-muted-foreground">
            No workspaces found
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/workspaces/new')}>
          <Plus className="mr-2 h-4 w-4" />
          <span>Create Workspace</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
