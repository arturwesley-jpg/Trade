import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket.js";
import { API_WS_URL } from "../config/api";

export type NotificationType = "info" | "success" | "warning" | "error" | "alert";
export type NotificationPriority = "low" | "medium" | "high" | "critical";

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  data?: any;
}

export interface UseNotificationsOptions {
  wsUrl?: string;
  token?: string;
  userId?: string;
  autoConnect?: boolean;
  maxNotifications?: number;
  autoMarkReadAfter?: number; // milliseconds
  onNotification?: (notification: Notification) => void;
  onError?: (error: Error) => void;
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  error: Error | null;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  getNotificationsByType: (type: NotificationType) => Notification[];
  getNotificationsByPriority: (priority: NotificationPriority) => Notification[];
}

/**
 * Hook for managing real-time notifications via WebSocket
 *
 * Features:
 * - Real-time notification delivery
 * - Read/unread state management
 * - Auto-mark as read after timeout
 * - Filter by type and priority
 * - Notification history with configurable limit
 * - Automatic cleanup
 *
 * @example
 * ```tsx
 * const { notifications, unreadCount, markAsRead } = useNotifications({
 * token: 'auth-token',
 * userId: 'user-123',
 * maxNotifications: 50,
 * onNotification: (notif) => toast.show(notif.message)
 * });
 * ```
 */
export function useNotifications(options: UseNotificationsOptions): UseNotificationsReturn {
  const {
    wsUrl = API_WS_URL,
    token,
    userId,
    autoConnect = true,
    maxNotifications = 100,
    autoMarkReadAfter,
    onNotification,
    onError
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const autoMarkTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const { isConnected, subscribe, unsubscribe, error } = useWebSocket({
    url: wsUrl,
    token,
    autoConnect,
    onError
  });

  const handleNotification = useCallback((data: unknown) => {
    try {
      const message = data as any;

      // Parse notification from different message formats
      let notification: Notification;

      if (message.type === "notification" && message.data) {
        notification = {
          id: message.data.id || `notif-${Date.now()}-${Math.random()}`,
          type: message.data.type || "info",
          priority: message.data.priority || "medium",
          title: message.data.title || "Notification",
          message: message.data.message || "",
          timestamp: message.data.timestamp || Date.now(),
          read: false,
          data: message.data.data
        };
      } else {
        // Direct notification format
        notification = {
          id: message.id || `notif-${Date.now()}-${Math.random()}`,
          type: message.type || "info",
          priority: message.priority || "medium",
          title: message.title || "Notification",
          message: message.message || "",
          timestamp: message.timestamp || Date.now(),
          read: false,
          data: message.data
        };
      }

      setNotifications((prev) => {
        const newNotifications = [notification, ...prev];
        // Keep only the last maxNotifications
        return newNotifications.slice(0, maxNotifications);
      });

      onNotification?.(notification);

      // Auto-mark as read after timeout
      if (autoMarkReadAfter && autoMarkReadAfter > 0) {
        const timer = setTimeout(() => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
          );
          autoMarkTimersRef.current.delete(notification.id);
        }, autoMarkReadAfter);

        autoMarkTimersRef.current.set(notification.id, timer);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to parse notification");
      console.error("[useNotifications] Parse error:", error);
      onError?.(error);
    }
  }, [maxNotifications, autoMarkReadAfter, onNotification, onError]);

  useEffect(() => {
    if (!isConnected) return;

    const channels: string[] = [];

    // Subscribe to user-specific notifications
    if (userId) {
      channels.push(`notifications:${userId}`);
    }

    // Subscribe to global notifications
    channels.push("notifications", "alerts", "system");

    channels.forEach((channel) => {
      subscribe(channel, handleNotification);
      console.log(`[useNotifications] Subscribed to ${channel}`);
    });

    return () => {
      channels.forEach((channel) => {
        unsubscribe(channel, handleNotification);
        console.log(`[useNotifications] Unsubscribed from ${channel}`);
      });

      // Clear all auto-mark timers
      autoMarkTimersRef.current.forEach((timer) => clearTimeout(timer));
      autoMarkTimersRef.current.clear();
    };
  }, [isConnected, userId, subscribe, unsubscribe, handleNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    // Clear auto-mark timer if exists
    const timer = autoMarkTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      autoMarkTimersRef.current.delete(id);
    }
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    // Clear all auto-mark timers
    autoMarkTimersRef.current.forEach((timer) => clearTimeout(timer));
    autoMarkTimersRef.current.clear();
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    // Clear auto-mark timer if exists
    const timer = autoMarkTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      autoMarkTimersRef.current.delete(id);
    }
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);

    // Clear all auto-mark timers
    autoMarkTimersRef.current.forEach((timer) => clearTimeout(timer));
    autoMarkTimersRef.current.clear();
  }, []);

  const getNotificationsByType = useCallback((type: NotificationType) => {
    return notifications.filter((n) => n.type === type);
  }, [notifications]);

  const getNotificationsByPriority = useCallback((priority: NotificationPriority) => {
    return notifications.filter((n) => n.priority === priority);
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    isConnected,
    error,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    getNotificationsByType,
    getNotificationsByPriority
  };
}
