'use client';

import * as React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { Menu } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  isDemo?: boolean;
}

export function AppShell({ children, isDemo = false }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Sidebar (using Dialog as a Drawer placeholder) */}
      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="w-[280px] sm:w-[320px] p-0 h-full left-0 translate-x-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left top-0 translate-y-0 rounded-none border-r">
          <DialogTitle className="sr-only">Navigation Menu</DialogTitle>
          <Sidebar />
        </DialogContent>
      </Dialog>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar 
          onMenuClick={() => setMobileMenuOpen(true)} 
          isDemo={isDemo} 
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
