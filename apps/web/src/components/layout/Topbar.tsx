'use client';

import * as React from 'react';
import { Menu, Beaker } from 'lucide-react';
import { NotificationBell } from '../NotificationBell';
import { UserMenu } from './UserMenu';
import { Button } from '../ui/button';

interface TopbarProps {
  onMenuClick?: () => void;
  isDemo?: boolean;
}

export function Topbar({ onMenuClick, isDemo = false }: TopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
          aria-label="Toggle Menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {isDemo && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Beaker className="h-3.5 w-3.5" />
            <span>Demo Mode</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {isDemo && (
          <div className="sm:hidden flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            <Beaker className="h-3 w-3" />
            Demo
          </div>
        )}
        <NotificationBell />
        <div className="md:hidden">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
