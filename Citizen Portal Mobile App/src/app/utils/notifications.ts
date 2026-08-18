export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'report' | 'alert' | 'loadshedding' | 'achievement' | 'system';
}

const STORAGE_KEY = 'appNotifications';

export function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function saveNotifications(notifications: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

export function addNotification(notification: Omit<AppNotification, 'id' | 'time' | 'read'>) {
  const notifications = loadNotifications();
  const newNotification: AppNotification = {
    ...notification,
    id: `notif-${Date.now()}`,
    time: new Date().toISOString(),
    read: false,
  };
  notifications.unshift(newNotification);
  saveNotifications(notifications.slice(0, 50));
  return loadNotifications();
}

export function markAllRead(): AppNotification[] {
  const notifications = loadNotifications().map((n) => ({ ...n, read: true }));
  saveNotifications(notifications);
  return notifications;
}

export function clearNotifications(): AppNotification[] {
  saveNotifications([]);
  return [];
}
