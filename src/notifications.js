import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "./auth.js";

const NotificationsContext = createContext({
  items: [], unreadCount: 0, unreadCaseIds: new Set(), markRead: () => {}, markCaseRead: () => {}, reload: () => {}
});

// Same as the web NotificationsContext: poll every 30 s while signed in (no sockets), plus on foreground.
export function NotificationsProvider({ children }) {
  const { client, user } = useAuth();
  const [items, setItems] = useState([]);

  const reload = useCallback(() => {
    if (!user) return;
    client.getNotifications().then(setItems).catch(() => {});
  }, [client, user]);

  useEffect(() => {
    if (!user) { setItems([]); return undefined; }
    reload();
    const timer = setInterval(reload, 30000);
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") reload(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [user, reload]);

  const markRead = useCallback((id) => {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    client.markNotificationRead(id).catch(() => {});
  }, [client]);

  const markCaseRead = useCallback((caseId) => {
    items.forEach((n) => { if (!n.read && String(n.data?.case_id) === caseId) client.markNotificationRead(n.id).catch(() => {}); });
    setItems((list) => list.map((n) => (String(n.data?.case_id) === caseId ? { ...n, read: true } : n)));
  }, [client, items]);

  const value = useMemo(() => {
    const unread = items.filter((n) => !n.read);
    const unreadCaseIds = new Set(unread.filter((n) => n.data?.case_id).map((n) => String(n.data.case_id)));
    return { items, unreadCount: unread.length, unreadCaseIds, markRead, markCaseRead, reload };
  }, [items, markRead, markCaseRead, reload]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);
