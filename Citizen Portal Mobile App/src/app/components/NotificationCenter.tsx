import { useState } from 'react';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import {
  loadNotifications,
  markAllRead,
  clearNotifications,
  type AppNotification,
} from '../utils/notifications';

const TYPE_ICON: Record<string, string> = {
  report: '📋',
  alert: '🚨',
  loadshedding: '⚡',
  achievement: '🏆',
  system: '🔔',
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(loadNotifications());
  const unread = notifications.filter((n) => !n.read).length;

  const handleMarkAll = () => {
    setNotifications(markAllRead());
  };

  const handleClear = () => {
    setNotifications(clearNotifications());
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center gap-2 px-3 py-2 rounded-lg border border-white/30 bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors text-white"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-[#1e5a7d] text-white">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAll}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Mark all read"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
              <button
                onClick={handleClear}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Clear all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <p className="text-3xl mb-2">🔕</p>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    !n.read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{TYPE_ICON[n.type] || '🔔'}</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatTime(n.time)}</p>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
