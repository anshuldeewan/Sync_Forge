'use client';

import * as React from 'react';
import { Menu, Beaker, Info } from 'lucide-react';
import { NotificationBell } from '../NotificationBell';
import { UserMenu } from './UserMenu';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../ui/dialog';

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
          <Dialog>
            <DialogTrigger asChild>
              <button className="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 transition-colors">
                <Beaker className="h-3.5 w-3.5" />
                <span>Demo Mode</span>
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Beaker className="h-5 w-5 text-amber-500" />
                  Demo Sandbox
                </DialogTitle>
                <DialogDescription className="pt-3">
                  You are currently exploring a read-only sandbox. Destructive actions (like deleting workspaces or removing members) are disabled to preserve the demo environment for others.
                  <br /><br />
                  All data in this sandbox resets every 24 hours.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {isDemo && (
          <Dialog>
            <DialogTrigger asChild>
              <button className="sm:hidden flex items-center gap-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 transition-colors">
                <Beaker className="h-3 w-3" />
                Demo
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Beaker className="h-5 w-5 text-amber-500" />
                  Demo Sandbox
                </DialogTitle>
                <DialogDescription className="pt-3">
                  You are currently exploring a read-only sandbox. Destructive actions are disabled. Data resets every 24 hours.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        )}
        <NotificationBell />
        <div className="md:hidden">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
