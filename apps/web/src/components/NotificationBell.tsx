'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, CheckCheck, BellRing, Inbox } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Skeleton } from './ui/skeleton';

export function NotificationBell() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetcher = async (url: string) => {
    if (!user) return { notifications: [] };
    const token = await user.getIdToken();
    const { getApiUrl } = await import('../config/api');
    const apiUrl = getApiUrl();
    const res = await fetch(`${apiUrl}${url}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  };

  const { data, mutate, isLoading } = useSWR(user ? '/api/notifications' : null, fetcher, { refreshInterval: 10000 });
  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markRead = async (id: string) => {
    if (!user) return;
    
    // Optimistic UI update
    mutate({ notifications: notifications.map((n: any) => n.id === id ? { ...n, isRead: true } : n) }, false);
    
    const token = await user.getIdToken();
    const { getApiUrl } = await import('../config/api');
    await fetch(`${getApiUrl()}/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    mutate();
  };

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    
    // Optimistic UI update
    mutate({ notifications: notifications.map((n: any) => ({ ...n, isRead: true })) }, false);
    
    const token = await user.getIdToken();
    const { getApiUrl } = await import('../config/api');
    await fetch(`${getApiUrl()}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    mutate();
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative rounded-full transition-all ${isOpen ? 'bg-accent text-accent-foreground' : ''}`}
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5" />
        ) : (
          <Bell className="h-5 w-5 text-muted-foreground" />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground animate-in zoom-in duration-300 shadow-sm border border-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[380px] z-50 animate-in slide-in-from-top-2 fade-in duration-200">
          <Card className="shadow-lg border-border overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border flex justify-between items-center bg-card sticky top-0 z-10">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            </div>
            
            <div className="overflow-y-auto flex-1 overscroll-contain">
              {isLoading && notifications.length === 0 ? (
                <div className="p-4 space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Inbox className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">You're all caught up!</p>
                    <p className="text-xs text-muted-foreground mt-1">No new notifications to show.</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notif: any) => (
                    <div 
                      key={notif.id} 
                      className={`relative group p-4 flex gap-3 cursor-pointer transition-all duration-200 ${
                        notif.isRead 
                          ? 'bg-background hover:bg-muted/40' 
                          : 'bg-primary/5 hover:bg-primary/10'
                      }`}
                      onClick={() => !notif.isRead && markRead(notif.id)}
                    >
                      {!notif.isRead && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r" />
                      )}
                      
                      <div className="flex-1 space-y-1">
                        <p className={`text-sm leading-snug ${notif.isRead ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                          {notif.message}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {new Date(notif.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      
                      {!notif.isRead && (
                        <div className="flex-shrink-0 pt-1">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {notifications.length > 0 && (
              <div className="p-2 border-t border-border bg-muted/20 text-center sticky bottom-0">
                <Button variant="link" className="text-xs h-auto py-1 text-muted-foreground hover:text-foreground w-full">
                  View Notification Settings
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
