import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Building2,
  Menu,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ChevronRight,
  Bell,
} from "lucide-react";
import { useAccountView, ProfileMenu } from "../AccountView";
import { useOverlayFocus } from "../../hooks/useOverlayFocus";
import { useApiResource } from "../../hooks/useApiResource";
import { communityApi } from "./api";
import type {
  CommunityContext,
  CommunityData,
} from "../../../../../shared/community";
import {
  deliveryTasks,
  defaultSection,
  managementModules,
  moduleUrl,
} from "./management";
import { viewHome, viewName } from "../../../../../shared/accountView";
import { NotificationDrawer } from "../NotificationDrawer";
import { api } from "../../api";
import type { NotificationRecord } from "../../types";
import { ErrorNotice } from "../../components/common";
import "./community.css";
import "./management.css";
import { WorkspaceContext } from "./WorkspaceContext";
import { ModuleIcon } from "./ModuleIcon";
export function WorkspaceShell({
  children,
  languageMenu,
}: {
  children: ReactNode;
  languageMenu?: ReactNode;
}) {
  const { view } = useAccountView();
  const mode = view.userContext;
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const context = useApiResource<CommunityContext | null>(
    useCallback((signal) => communityApi.context(signal), []),
    null,
  );
  const [lastProperty, setLastProperty] = useState(
    () => sessionStorage.getItem("communityhub.activeBuilding") ?? "",
  );
  const propertyPath = location.pathname.match(/^\/properties\/([^/]+)$/);
  const requested = propertyPath
    ? decodeURIComponent(propertyPath[1])
    : (params.get("property") ?? lastProperty);
  const properties = context.data?.properties ?? [];
  const selected = properties.some((p) => p.id === requested)
    ? requested!
    : (properties[0]?.id ?? "");
  useEffect(() => {
    if (selected && selected !== lastProperty) {
      setLastProperty(selected);
      sessionStorage.setItem("communityhub.activeBuilding", selected);
    }
  }, [selected, lastProperty]);
  const resource = useApiResource<CommunityData | null>(
    useCallback(
      (signal) =>
        selected
          ? communityApi.read(selected, signal)
          : Promise.resolve({ data: null }),
      [selected],
    ),
    null,
  );
  const modules = managementModules(mode, view.role);
  const root = viewHome(mode, view.role);
  const requestedSection = params.get("section") ?? defaultSection(mode);
  const current =
    location.pathname === root
      ? (modules.find((m) => m.id === requestedSection) ?? modules[0])
      : modules.find(
          (m) =>
            m.path &&
            (location.pathname === m.path ||
              location.pathname.startsWith(m.path + "/")),
        );
  const section =
    current?.id ??
    (location.pathname.startsWith("/tenant")
      ? "my-repairs"
      : defaultSection(mode));
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (
      previousPath.current !== location.pathname &&
      location.pathname === root
    )
      resource.refresh();
    previousPath.current = location.pathname;
  }, [location.pathname, root, resource.refresh]);
  const go = (id: string, tab?: string) => {
    const item = modules.find((m) => m.id === id);
    if (item) {
      const url = moduleUrl(item, mode, selected);
      navigate(url + (tab ? "&tab=" + encodeURIComponent(tab) : ""));
    }
  };
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("communityhub.sidebar.collapsed") === "true",
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navButton = useRef<HTMLButtonElement>(null);
  const navRef = useOverlayFocus<HTMLElement>(open, () => setOpen(false));
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setOpen(false);
    setSearchOpen(false);
    setSearch("");
  }, [location.pathname, location.search]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node))
        setSearchOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const notifications = useApiResource<NotificationRecord[]>(
    useCallback(
      (signal) =>
        mode === 2 ? api.notifications(signal) : Promise.resolve({ data: [] }),
      [mode],
    ),
    [],
  );
  const unread = notifications.data.filter((n) => !n.read).length;
  const scopedData =
    resource.data?.property.id === selected ? resource.data : null;
  const count = scopedData
    ? scopedData.orders.filter((o) =>
        ["placed", "accepted", "ready"].includes(o.status),
      ).length +
      scopedData.serviceRequests.filter((r) =>
        ["requested", "accepted"].includes(r.status),
      ).length +
      scopedData.gateEntries.filter(
        (g) => g.approval === "pending" && g.status === "expected",
      ).length +
      deliveryTasks(scopedData).length +
      scopedData.notes.filter((n) => n.kind === "round" && n.status === "open")
        .length +
      (mode === 2
        ? scopedData.sellers.filter((s) => s.status === "pending").length +
          scopedData.payments.filter((p) => p.status === "pending").length
        : 0)
    : 0;
  const term = search.trim().toLowerCase();
  const matches = term
    ? modules.filter((m) =>
        (m.title + " " + m.description).toLowerCase().includes(term),
      )
    : [];
  const records = term
    ? [
        ...(scopedData?.products ?? [])
          .filter((p) => p.name.toLowerCase().includes(term))
          .map((p) => ({ name: p.name, section: "market", kind: "Product" })),
        ...(scopedData?.services ?? [])
          .filter((s) => s.name.toLowerCase().includes(term))
          .map((s) => ({ name: s.name, section: "services", kind: "Service" })),
      ]
        .filter((r) => modules.some((m) => m.id === r.section))
        .slice(0, 5)
    : [];
  return (
    <WorkspaceContext.Provider
      value={{ context, resource, selected, section, modules, go }}
    >
      <div className={`ch-shell ${collapsed ? "ch-collapsed" : ""}`}>
        <a className="skip-link" href="#workspace-content">
          Skip to content
        </a>
        <header className="ch-topbar">
          <div className="ch-brand-area">
            <button
              ref={navButton}
              className="ch-nav-toggle"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <Menu size={21} />
            </button>
            <Link
              className="ch-brand"
              to={
                root +
                (selected
                  ? "?" + new URLSearchParams({ property: selected })
                  : "")
              }
            >
              <span>
                <Building2 size={24} />
              </span>
              <strong>
                CommunityHub<small>APARTMENT MANAGEMENT</small>
              </strong>
            </Link>
          </div>
          <div className="ch-global-search" ref={searchRef}>
            <Search size={18} />
            <input
              aria-label="Search workspace"
              placeholder="Search modules, products and services"
              value={search}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchOpen(false);
                if (e.key === "Enter" && matches[0])
                  navigate(moduleUrl(matches[0], mode, selected));
              }}
            />
            {search && (
              <button
                aria-label="Clear workspace search"
                onClick={() => setSearch("")}
              >
                <X size={15} />
              </button>
            )}
            {searchOpen && term && (
              <div
                className="ch-search-results"
                aria-label="Workspace search results"
              >
                {matches.slice(0, 5).map((m) => (
                  <Link key={m.id} to={moduleUrl(m, mode, selected)}>
                    <ModuleIcon name={m.icon} />
                    <span>
                      <strong>{m.title}</strong>
                      <small>{m.group}</small>
                    </span>
                    <ChevronRight size={16} />
                  </Link>
                ))}
                {records.map((r, i) => (
                  <Link
                    key={i}
                    to={moduleUrl(
                      modules.find((m) => m.id === r.section)!,
                      mode,
                      selected,
                      r.name,
                    )}
                  >
                    <Search size={16} />
                    <span>
                      <strong>{r.name}</strong>
                      <small>{r.kind}</small>
                    </span>
                    <ChevronRight size={16} />
                  </Link>
                ))}
                {!matches.length && !records.length && (
                  <p>No results in your current view.</p>
                )}
              </div>
            )}
          </div>
          <div className="ch-header-actions">
            <label className="ch-building-select">
              <Building2 size={16} />
              <select
                aria-label="Community"
                value={selected}
                disabled={!properties.length}
                onChange={(e) => {
                  const next = new URLSearchParams(location.search);
                  next.set("property", e.target.value);
                  navigate({
                    pathname: propertyPath
                      ? "/properties/" + encodeURIComponent(e.target.value)
                      : location.pathname,
                    search: next.toString(),
                  });
                }}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {!properties.length && (
                  <option value="">No community assigned</option>
                )}
              </select>
            </label>
            {languageMenu}
            <button
              className="ch-icon-button"
              aria-label={
                mode === 2
                  ? `Open notifications${unread ? `, ${unread} unread` : ""}`
                  : `Open action center${count ? `, ${count} items` : ""}`
              }
              onClick={() => (mode === 2 ? setInboxOpen(true) : go("actions"))}
            >
              <Bell size={20} />
              {(mode === 2 ? unread : count) > 0 && (
                <span>
                  {(mode === 2 ? unread : count) > 99
                    ? "99+"
                    : mode === 2
                      ? unread
                      : count}
                </span>
              )}
            </button>
            <ProfileMenu />
          </div>
        </header>
        <div className="ch-layout">
          {open && (
            <button
              className="ch-nav-backdrop"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
            />
          )}
          <aside
            ref={navRef}
            className={`ch-sidebar ${open ? "is-open" : ""}`}
            role={open ? "dialog" : undefined}
            aria-modal={open || undefined}
            aria-label={`${viewName(mode)} workspace navigation`}
          >
            <div className="ch-sidebar-heading">
              <span>{viewName(mode)} workspace</span>
              <button
                className="ch-mobile-close"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <label className="ch-nav-property">
              Apartment
              <select
                aria-label="Navigation apartment"
                value={selected}
                onChange={(e) => {
                  const next = new URLSearchParams({
                    property: e.target.value,
                  });
                  if (!current?.path) next.set("section", section);
                  navigate({
                    pathname: propertyPath
                      ? "/properties/" + encodeURIComponent(e.target.value)
                      : location.pathname,
                    search: next.toString(),
                  });
                }}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {!properties.length && (
                  <option value="">No community assigned</option>
                )}
              </select>
            </label>
            <nav aria-label="Workspace modules">
              {[...new Set(modules.map((m) => m.group))].map((group) => (
                <div className="ch-nav-group" key={group}>
                  <span className="ch-sidebar-caption">{group}</span>
                  {modules
                    .filter((m) => m.group === group)
                    .map((m) => (
                      <Link
                        key={m.id}
                        className={section === m.id ? "active" : ""}
                        aria-current={section === m.id ? "page" : undefined}
                        to={moduleUrl(m, mode, selected)}
                        aria-label={m.title}
                        title={collapsed ? m.title : undefined}
                      >
                        <ModuleIcon name={m.icon} size={19} />
                        <span>{m.title}</span>
                        {m.id === "actions" && count > 0 && (
                          <small>{count}</small>
                        )}
                      </Link>
                    ))}
                </div>
              ))}
            </nav>
            <button
              className="ch-collapse-button"
              aria-label={
                collapsed ? "Expand navigation" : "Collapse navigation"
              }
              onClick={() => {
                setCollapsed(!collapsed);
                localStorage.setItem(
                  "communityhub.sidebar.collapsed",
                  String(!collapsed),
                );
              }}
            >
              {collapsed ? (
                <PanelLeftOpen size={19} />
              ) : (
                <PanelLeftClose size={19} />
              )}
              <span>Collapse navigation</span>
            </button>
          </aside>
          <main className="ch-content" id="workspace-content" tabIndex={-1}>
            <div className="ch-page-context">
              <nav aria-label="Breadcrumb">
                <Link
                  to={
                    root +
                    (selected
                      ? "?property=" + encodeURIComponent(selected)
                      : "")
                  }
                >
                  {viewName(mode)} workspace
                </Link>
                <ChevronRight size={13} aria-hidden="true" />
                {propertyPath ? (
                  <>
                    <Link to="/properties">Communities &amp; flats</Link>
                    <ChevronRight size={13} aria-hidden="true" />
                    <strong aria-current="page">
                      {properties.find((p) => p.id === selected)?.name ??
                        "Community setup"}
                    </strong>
                  </>
                ) : location.pathname.startsWith("/requests/") ||
                  location.pathname.startsWith("/tenant/") ? (
                  <>
                    <Link to={current?.path ?? "/tenant"}>
                      {current?.title ?? "My repairs"}
                    </Link>
                    <ChevronRight size={13} aria-hidden="true" />
                    <strong aria-current="page">
                      {location.pathname.endsWith("/new") ||
                      location.pathname.endsWith("/report")
                        ? "Report an issue"
                        : "Request details"}
                    </strong>
                  </>
                ) : (
                  <strong aria-current="page">
                    {current?.title ?? "My repairs"}
                  </strong>
                )}
              </nav>
              <small>
                {properties.find((p) => p.id === selected)?.name ??
                  "Your community"}
              </small>
            </div>
            {context.error && (
              <ErrorNotice message={context.error} onRetry={context.refresh} />
            )}
            {location.pathname === root && (
              <div className="ch-page-title">
                <h1>{current?.title ?? "My repairs"}</h1>
                <p>
                  {current?.description ??
                    "Report an issue and stay up to date."}
                </p>
              </div>
            )}
            {children}
          </main>
        </div>
        {mode === 2 && inboxOpen && (
          <NotificationDrawer
            onClose={() => setInboxOpen(false)}
            onCountChange={notifications.refresh}
          />
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
