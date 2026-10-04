import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { api } from "../api";
import { useOverlayFocus } from "../hooks/useOverlayFocus";
import { useApiResource } from "../hooks/useApiResource";
import { ErrorNotice, LoadingState, EmptyState } from "../components/common";
import { formatDate } from "./operations";
import type { NotificationRecord } from "../types";
export function NotificationDrawer({
  onClose,
  onCountChange,
}: {
  onClose: () => void;
  onCountChange: (count: number) => void;
}) {
  const navigate = useNavigate();
  const overlayRef = useOverlayFocus<HTMLElement>(true, onClose);
  const {
    data: items,
    loading,
    error,
    setError,
    refresh: load,
  } = useApiResource(
    useCallback((signal) => api.notifications(signal), []),
    [] as NotificationRecord[],
  );
  useEffect(() => {
    if (!loading) onCountChange(items.filter((item) => !item.read).length);
  }, [items, loading, onCountChange]);
  const markRead = async (item: NotificationRecord) => {
    try {
      const { data } = await api.markNotificationRead(item.id);
      onCountChange(
        items.filter((entry) =>
          entry.id === item.id ? !data.read : !entry.read,
        ).length,
      );
      onClose();
      if (item.href) navigate(item.href);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Notification could not be updated.",
      );
    }
  };
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer"
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <span className="label">INBOX</span>
            <h2>Notifications</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close notifications"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {error ? <ErrorNotice message={error} onRetry={load} /> : null}
        <div className="notification-list">
          {loading ? (
            <LoadingState label="Loading notifications…" />
          ) : (
            items.map((item) => (
              <button
                className={`notification-item ${item.read ? "read" : ""}`}
                key={item.id}
                onClick={() => {
                  void markRead(item);
                }}
              >
                <span className={`notification-dot ${item.type}`} />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                  <small>
                    {/^\d{4}-\d{2}-\d{2}T/.test(item.at)
                      ? formatDate(item.at)
                      : item.at}
                  </small>
                </div>
                {!item.read ? <i /> : null}
              </button>
            ))
          )}
          {!loading && !items.length && !error ? (
            <EmptyState
              title="All clear"
              detail="New actions and messages will appear here."
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}
