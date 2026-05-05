import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "build" | "complete" | "info";
  timestamp: Date;
  read: boolean;
}

interface NotificationsContextValue {
  notifications: Notification[];
  hasUnread: boolean;
  addNotification: (n: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((n: Omit<Notification, "id" | "timestamp" | "read">) => {
    const notif: Notification = {
      ...n,
      id: Math.random().toString(36).slice(2),
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [notif, ...prev].slice(0, 20));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const hasUnread = notifications.some(n => !n.read);

  return (
    <NotificationsContext.Provider value={{ notifications, hasUnread, addNotification, markAllRead, clearAll }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
  return ctx;
}
