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
    wsUrl: string;
    token?: string;
    userId?: string;
    autoConnect?: boolean;
    maxNotifications?: number;
    autoMarkReadAfter?: number;
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
 *   wsUrl: 'ws://localhost:3000/ws',
 *   token: 'auth-token',
 *   userId: 'user-123',
 *   maxNotifications: 50,
 *   onNotification: (notif) => toast.show(notif.message)
 * });
 * ```
 */
export declare function useNotifications(options: UseNotificationsOptions): UseNotificationsReturn;
