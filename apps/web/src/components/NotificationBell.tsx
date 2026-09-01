'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useAuth } from '../context/AuthContext';

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

  const { data, mutate } = useSWR(user ? '/api/notifications' : null, fetcher, { refreshInterval: 10000 });
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
    const token = await user.getIdToken();
    const { getApiUrl } = await import('../config/api');
    await fetch(`${getApiUrl()}/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    mutate();
  };

  const markAllRead = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const { getApiUrl } = await import('../config/api');
    await fetch(`${getApiUrl()}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    mutate();
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-950">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map((notif: any) => (
                <div 
                  key={notif.id} 
                  className={`p-4 border-b border-gray-100 dark:border-zinc-800 flex flex-col gap-1 cursor-pointer transition-colors ${notif.isRead ? 'opacity-70 bg-white dark:bg-zinc-900' : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
                  onClick={() => !notif.isRead && markRead(notif.id)}
                >
                  <p className="text-sm text-gray-800 dark:text-gray-200">{notif.message}</p>
                  <span className="text-xs text-gray-400">
                    {new Date(notif.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
