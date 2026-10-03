import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Download,
  FileCheck2,
  Filter,
  Columns3,
  Home,
  Languages,
  LayoutDashboard,
  List,
  LifeBuoy,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Store,
  Upload,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { api, validateEvidence } from "./api";
import { useApiResource } from "./hooks/useApiResource";
import {
  PageHeader,
  Button,
  Pill,
  StatCard,
  Fact,
  LoadingState,
  ErrorNotice,
  EmptyState,
  Timeline,
  ActionRow,
} from "./components/common";
import { useObjectUrl } from "./hooks/useObjectUrl";
import { useOverlayFocus } from "./hooks/useOverlayFocus";
import { CommonAreaSection } from "./features/CommonAreaSection";
import {
  RequestBoard,
  RequestCard,
  RequestStatus,
  RepairProgress,
  VisitConfirmation,
} from "./features/OperationsUI";
import {
  approvedQuoteTotals,
  currencySymbol,
  formatMoney as money,
  quoteCurrency,
  supportedCurrencies,
} from "./features/money";
import {
  ageLabel,
  displayId,
  formatDate,
  isOpen,
  managerAction,
  matchesFilter,
  nextStep,
  propertyDateInput,
  requestFilters,
  residentAction,
  sortRequests,
  type RequestSort,
} from "./features/operations";
import { demoMode, supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";
const emptyDashboard: DashboardData = {
  urgent: 0,
  awaitingYou: 0,
  visitsToday: 0,
  residentVerified: null,
  requests: [],
  schedule: [],
};
import type {
  DashboardData,
  LanguageCode,
  MessageRecord,
  NotificationRecord,
  PropertyRecord,
  RequestDetail,
  RequestRecord,
  RequestState,
  VendorRecord,
} from "./types";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, fallback: string) => string;
};
const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => undefined,
  t: (_key, fallback) => fallback,
});
const languageNames: Record<LanguageCode, string> = {
  en: "English",
  hi: "हिन्दी",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ar: "العربية",
};
const translations: Partial<Record<LanguageCode, Record<string, string>>> = {
  hi: {
    today: "आज",
    requests: "अनुरोध",
    properties: "प्रॉपर्टी",
    vendors: "वेंडर",
    costs: "लागत",
    settings: "सेटिंग्स",
    search: "खोजें",
    residentPortal: "निवासी पोर्टल",
    newRequest: "नया अनुरोध",
  },
  es: {
    today: "Hoy",
    requests: "Solicitudes",
    properties: "Propiedades",
    vendors: "Proveedores",
    costs: "Costes",
    settings: "Ajustes",
    search: "Buscar",
    residentPortal: "Portal del residente",
    newRequest: "Nueva solicitud",
  },
  fr: {
    today: "Aujourd'hui",
    requests: "Demandes",
    properties: "Propriétés",
    vendors: "Prestataires",
    costs: "Coûts",
    settings: "Paramètres",
    search: "Rechercher",
    residentPortal: "Portail résident",
    newRequest: "Nouvelle demande",
  },
  de: {
    today: "Heute",
    requests: "Anfragen",
    properties: "Objekte",
    vendors: "Dienstleister",
    costs: "Kosten",
    settings: "Einstellungen",
    search: "Suchen",
    residentPortal: "Bewohnerportal",
    newRequest: "Neue Anfrage",
  },
  ar: {
    today: "اليوم",
    requests: "الطلبات",
    properties: "العقارات",
    vendors: "الموردون",
    costs: "التكاليف",
    settings: "الإعدادات",
    search: "بحث",
    residentPortal: "بوابة المقيم",
    newRequest: "طلب جديد",
  },
};

function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem("repairledger-language");
    return saved && saved in languageNames ? (saved as LanguageCode) : "en";
  });
  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    localStorage.setItem("repairledger-language", next);
  }, []);
  const t = useCallback(
    (key: string, fallback: string) =>
      translations[language]?.[key] ?? fallback,
    [language],
  );
  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

function LanguageMenu({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useContext(LanguageContext);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const root = menuRef.current;
    const items = () =>
      Array.from(
        root?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ??
          [],
      );
    (
      items().find((item) => item.getAttribute("aria-checked") === "true") ??
      items()[0]
    )?.focus();
    const close = (event: PointerEvent) => {
      if (!root?.contains(event.target as Node)) setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (!root?.contains(event.target as Node)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        root.querySelector<HTMLButtonElement>(".language-chip")?.focus();
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const buttons = items();
        const current = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        buttons[
          (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
            buttons.length
        ]?.focus();
      }
      if (event.key === "Tab") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    root?.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", close);
      root?.removeEventListener("keydown", keyboard);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={menuRef}>
      <button
        className="language-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Languages size={15} /> {languageNames[language]}
      </button>
      {open ? (
        <div
          className={`popover language-menu ${compact ? "compact" : ""}`}
          role="menu"
          aria-label="Interface language"
        >
          {(Object.keys(languageNames) as LanguageCode[]).map((code) => (
            <button
              role="menuitemradio"
              aria-checked={code === language}
              key={code}
              className={code === language ? "selected" : ""}
              onClick={() => {
                setLanguage(code);
                setOpen(false);
                menuRef.current
                  ?.querySelector<HTMLButtonElement>(".language-chip")
                  ?.focus();
              }}
            >
              {languageNames[code]}{" "}
              {code === language ? <Check size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const RoleContext = createContext({
  role: "demo",
  displayName: "Maya Chen",
  workspaceName: "Oak Street Rentals",
});

function App() {
  return (
    <LanguageProvider>
      <AuthGate />
    </LanguageProvider>
  );
}

function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(demoMode);
  const [mobileAccountError, setMobileAccountError] = useState("");
  useEffect(() => {
    if (demoMode) return;
    if (!supabase) {
      setReady(true);
      return;
    }
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setReady(true);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  if (!ready)
    return (
      <div className="auth-shell">
        <LoadingState label="Checking your account…" />
      </div>
    );
  if (!demoMode && !supabase)
    return (
      <div className="auth-shell">
        <div className="surface auth-card">
          <PublicHeader
            eyebrow="Setup required"
            title="Authentication is not configured"
            description="Add the Supabase URL and public anon key to the web environment, then restart the app."
          />
        </div>
      </div>
    );
  if (!demoMode && !session) return <SignInPage />;
  const role = demoMode
    ? "demo"
    : String(session?.user.app_metadata?.role ?? "owner");
  if (role === "watchman") return <div className="auth-shell"><div className="surface auth-card">
    <PublicHeader eyebrow="Apartment mobile app" title="Use the RepairLedger mobile app" description="Watchman accounts coordinate confirmed vendor visits and shared-area reports in the mobile app. This account does not have access to the manager workspace." />
    {mobileAccountError ? <ErrorNotice message={mobileAccountError} onRetry={() => setMobileAccountError("")} /> : null}
    <Button variant="secondary" onClick={() => { void supabase?.auth.signOut({ scope: "local" }).then(result => { if (result.error) setMobileAccountError(result.error.message); }).catch(() => setMobileAccountError("Could not sign out. Please retry.")); }}>Sign out</Button>
  </div></div>;
  const displayName = demoMode
    ? "Maya Chen"
    : typeof session?.user.user_metadata?.name === "string"
      ? session.user.user_metadata.name
      : (session?.user.email?.split("@")[0] ?? "Workspace owner");
  const workspaceName = demoMode
    ? "Oak Street Rentals"
    : typeof session?.user.app_metadata?.workspace_name === "string"
      ? session.user.app_metadata.workspace_name
      : "Your workspace";
  return (
    <RoleContext.Provider value={{ role, displayName, workspaceName }}>
      <ProductRoutes />
    </RoleContext.Provider>
  );
}

function SignInPage() {
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!supabase) throw new Error("Authentication is not configured.");
      if (creating) {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (authError) throw authError;
        if (!data.session)
          setNotice("Check your email to confirm your account, then sign in.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not complete sign in.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-shell">
      <header className="public-brand">
        <Link to="/" className="brand-row">
          <span className="brand-mark">R</span>
          <span className="brand-name">RepairLedger</span>
        </Link>
      </header>
      <main className="surface auth-card">
        <PublicHeader
          eyebrow="Repair operations"
          title={creating ? "Create your workspace" : "Welcome back"}
          description={
            creating
              ? "Start with your account. Add properties and invite your team after sign in."
              : "Sign in to manage repairs, vendor work, and approvals."
          }
        />
        {error ? (
          <div className="notice danger">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}
        {notice ? (
          <div className="notice success">
            <Check size={18} />
            <span>{notice}</span>
          </div>
        ) : null}
        <form className="estimate-form" onSubmit={submit}>
          {creating ? (
            <label>
              Your name
              <input
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={creating ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait…" : creating ? "Create account" : "Sign in"}
          </Button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setCreating((value) => !value);
            setError("");
            setNotice("");
          }}
        >
          {creating
            ? "Already have an account? Sign in"
            : "New to RepairLedger? Create an account"}
        </button>
      </main>
    </div>
  );
}

function RoleRoute({
  allowed,
  children,
}: {
  allowed: string[];
  children: ReactNode;
}) {
  const { role } = useContext(RoleContext);
  if (role === "demo" || allowed.includes(role)) return children;
  const destination =
    role === "tenant" ? "/tenant" : role === "vendor" ? "/vendor/jobs" : "/";
  return <Navigate to={destination} replace />;
}

function ProductRoutes() {
  return (
    <Routes>
      <Route
        path="/tenant"
        element={
          <RoleRoute allowed={["tenant", "owner", "manager"]}>
            <TenantHome />
          </RoleRoute>
        }
      />
      <Route
        path="/tenant/report"
        element={
          <RoleRoute allowed={["tenant", "owner", "manager"]}>
            <TenantReport />
          </RoleRoute>
        }
      />
      <Route
        path="/tenant/status/:id/messages"
        element={
          <RoleRoute allowed={["tenant", "owner", "manager"]}>
            <TenantMessages />
          </RoleRoute>
        }
      />
      <Route
        path="/tenant/status/:id"
        element={
          <RoleRoute allowed={["tenant", "owner", "manager"]}>
            <TenantRepairStatus />
          </RoleRoute>
        }
      />
      <Route
        path="/vendor/jobs"
        element={
          <RoleRoute allowed={["vendor"]}>
            <VendorQueue />
          </RoleRoute>
        }
      />
      <Route
        path="/vendor/jobs/:id"
        element={
          <RoleRoute allowed={["vendor"]}>
            <VendorJobPortal />
          </RoleRoute>
        }
      />
      <Route
        path="/vendor/jobs/:id/estimate"
        element={
          <RoleRoute allowed={["vendor"]}>
            <VendorEstimateEntry />
          </RoleRoute>
        }
      />
      <Route
        path="*"
        element={
          <RoleRoute allowed={["owner", "manager"]}>
            <LandlordApp />
          </RoleRoute>
        }
      />
    </Routes>
  );
}

function LandlordApp() {
  return (
    <Shell>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/new" element={<NewRequest />} />
        <Route path="requests/:id" element={<RequestWorkspace />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="properties" element={<Properties />} />
        <Route path="properties/:id" element={<PropertyDetail />} />
        <Route path="costs" element={<Costs />} />
        <Route path="settings/languages" element={<LanguageSettings />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { t } = useContext(LanguageContext);
  const account = useContext(RoleContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [requestCount, setRequestCount] = useState<number | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState<number | null>(
    null,
  );
  const [searchRecords, setSearchRecords] = useState<RequestRecord[]>([]);
  const navRef = useOverlayFocus<HTMLElement>(mobileNav, () =>
    setMobileNav(false),
  );
  useEffect(() => {
    let active = true;
    api
      .requests()
      .then(({ data }) => {
        if (active) {
          setRequestCount(data.filter(isOpen).length);
          setSearchRecords(data);
        }
      })
      .catch(() => undefined);
    api
      .notifications()
      .then(({ data }) => {
        if (active)
          setUnreadNotifications(data.filter((item) => !item.read).length);
      })
      .catch(() => {
        if (active) setUnreadNotifications(null);
      });
    return () => {
      active = false;
    };
  }, [location.pathname]);
  const links = [
    { to: "/", label: t("today", "Today"), icon: LayoutDashboard },
    { to: "/requests", label: t("requests", "Requests"), icon: ClipboardList },
    { to: "/properties", label: t("properties", "Properties"), icon: Home },
    { to: "/vendors", label: t("vendors", "Vendors"), icon: Store },
    { to: "/costs", label: t("costs", "Costs"), icon: CircleDollarSign },
    {
      to: "/settings/languages",
      label: t("settings", "Settings"),
      icon: Settings2,
    },
  ];
  const suggestions = useMemo(
    () =>
      searchRecords
        .filter((item) =>
          `${item.id} ${item.title} ${item.property}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .slice(0, 4),
    [searchRecords, search],
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside
        className={`sidebar ${mobileNav ? "open" : ""}`}
        ref={navRef}
        role={mobileNav ? "dialog" : undefined}
        aria-modal={mobileNav ? true : undefined}
        aria-label="Workspace navigation"
      >
        <div className="brand-row">
          <Link to="/" className="brand-row">
            <span className="brand-mark">R</span>
            <span className="brand-name">RepairLedger</span>
          </Link>
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          >
            <X size={18} />
          </button>
        </div>
        <button
          className="workspace-switcher"
          onClick={() => navigate("/settings/languages?workspace=1")}
        >
          <div className="avatar avatar-small">
            {account.workspaceName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{account.workspaceName}</strong>
            <span>{formatState(account.role)} workspace</span>
          </div>
          <ChevronDown size={15} />
        </button>
        <div className="nav-section-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobileNav(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={17} />
              <span>{label}</span>
              {to === "/requests" ? <small>{requestCount ?? "—"}</small> : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link className="sidebar-portal-link" to="/tenant">
            Open resident portal <ArrowUpRightIcon />
          </Link>
          <Link className="help-card" to="/settings/languages?help=1">
            <LifeBuoy size={17} />
            <div>
              <strong>Need a hand?</strong>
              <span>Open the operator guide</span>
            </div>
            <ArrowRight size={15} />
          </Link>
          <button
            className="profile-row"
            onClick={() => navigate("/settings/languages?profile=1")}
          >
            <div className="avatar">
              {account.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{account.displayName}</strong>
              <span>
                {formatState(account.role)} · {account.workspaceName}
              </span>
            </div>
            <MoreHorizontal size={16} />
          </button>
        </div>
      </aside>
      {mobileNav ? (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      ) : null}
      <div className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={20} />
          </button>
          <div className="global-search">
            <Search size={16} />
            <input
              aria-label="Search repair requests"
              value={search}
              placeholder={`${t("search", "Search")} repair requests…`}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                setSearch(event.target.value);
                setSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && search.trim()) {
                  setSearchOpen(false);
                  navigate(
                    `/requests?search=${encodeURIComponent(search.trim())}`,
                  );
                }
                if (event.key === "Escape") setSearchOpen(false);
              }}
            />
            {searchOpen && search ? (
              <div className="search-results">
                {suggestions.length ? (
                  suggestions.map((item) => (
                    <Link
                      key={item.id}
                      to={`/requests/${item.id}`}
                      onClick={() => setSearchOpen(false)}
                    >
                      <strong>{item.id}</strong>
                      <span>
                        {item.title} · {item.property} {item.unit}
                      </span>
                    </Link>
                  ))
                ) : (
                  <span className="muted">
                    No matching records. Press Enter to search all requests.
                  </span>
                )}
              </div>
            ) : null}
          </div>
          <div className="topbar-actions">
            <Link className="portal-link" to="/tenant">
              {t("residentPortal", "Open resident portal")} <ArrowUpRightIcon />
            </Link>
            <LanguageMenu />
            <button
              className="notification-button"
              aria-label="Open notifications"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell size={17} />
              {unreadNotifications !== null && unreadNotifications > 0 ? (
                <i />
              ) : null}
            </button>
            <button
              className="avatar"
              aria-label={demoMode ? "View demo profile" : "Sign out"}
              title={demoMode ? "View demo profile" : "Sign out"}
              onClick={() =>
                demoMode
                  ? navigate("/settings/languages?profile=1")
                  : void supabase?.auth.signOut()
              }
            >
              {account.displayName.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
      {notificationsOpen ? (
        <NotificationDrawer
          onClose={() => setNotificationsOpen(false)}
          onCountChange={setUnreadNotifications}
        />
      ) : null}
    </div>
  );
}

function NotificationDrawer({
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
function ArrowUpRightIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

// Shared presentation components live in components/common.tsx.

function Dashboard() {
  const { t } = useContext(LanguageContext);
  const [queue, setQueue] = useState<"decisions" | "others">("decisions");
  const { data, error, loading, refresh, lastLoadedAt } = useApiResource(
    useCallback((signal) => api.dashboard(signal), []),
    emptyDashboard,
  );
  const decisions = useMemo(
    () =>
      sortRequests(
        data.requests.filter((item) => managerAction(item) !== null),
      ),
    [data.requests],
  );
  const waiting = useMemo(
    () =>
      sortRequests(
        data.requests.filter(
          (item) => isOpen(item) && managerAction(item) === null,
        ),
      ),
    [data.requests],
  );
  const verification = data.requests.filter((item) =>
    matchesFilter(item, "verification"),
  ).length;
  const urgent = data.requests.filter((item) =>
    matchesFilter(item, "urgent"),
  ).length;
  const open = data.requests.filter(isOpen).length;
  const quotes = data.requests.filter(
    (item) => managerAction(item) === "review_quote",
  ).length;
  const visible = queue === "decisions" ? decisions : waiting;
  if (loading && !lastLoadedAt)
    return <LoadingState label="Loading maintenance overview…" />;
  return (
    <>
      <PageHeader
        eyebrow={
          demoMode ? "Sample workspace · demo data" : "Maintenance workspace"
        }
        title="A clear view of every repair."
        description="Know what needs you. Keep everyone moving."
        action={
          <div className="button-row">
            <Button variant="secondary" onClick={refresh} disabled={loading}>
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              Refresh
            </Button>
            <Link className="button primary" to="/requests/new">
              <Plus size={17} />
              {t("newRequest", "New request")}
            </Link>
          </div>
        }
      />
      {error ? <ErrorNotice message={error} onRetry={refresh} /> : null}
      {error ? (
        <div className="data-state-note" role="status">
          Overview unavailable. Refresh to see current decisions; no zero or
          success metrics are being inferred.
        </div>
      ) : (
        <>
          <section className="operations-hero">
            <div className="hero-copy">
              <div className="hero-kicker">
                <span className="hero-pulse" />
                YOUR NEXT MOVE
              </div>
              <h2>
                {decisions.length
                  ? `${decisions.length} ${decisions.length === 1 ? "decision" : "decisions"}. Less chasing.`
                  : "No decisions waiting on you."}
              </h2>
              <p>
                {decisions.length
                  ? "New reports, vendor choices, quote reviews and visits—prioritized by urgency, then oldest report."
                  : open
                    ? "Work is still moving. Check who is responding next and keep an eye on urgent repairs."
                    : "A calmer way to manage maintenance, from the first report to a resident-verified repair."}
              </p>
              <div className="hero-links">
                <Link to="/requests?filter=awaiting">
                  {decisions.length ? "Open decision queue" : "Review requests"}
                  <ArrowRight size={15} />
                </Link>
                <Link to="/requests?view=board&filter=open">
                  See the workflow
                  <Columns3 size={15} />
                </Link>
              </div>
            </div>
            <div className="hero-summary">
              <span>PORTFOLIO SNAPSHOT</span>
              <strong>
                {open}
                <small>open repairs</small>
              </strong>
              <div>
                <span>
                  <i className="urgent-indicator" />
                  {urgent} urgent
                </span>
                <span>
                  <i className="verify-indicator" />
                  {verification} to verify
                </span>
              </div>
              <small>
                {lastLoadedAt
                  ? `Fetched ${lastLoadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · refresh for updates`
                  : "Loading current records"}
              </small>
            </div>
          </section>
          <section className="stat-grid" aria-label="Maintenance metrics">
            <StatCard
              label="URGENT & OPEN"
              value={String(urgent)}
              detail="Closed repairs excluded"
              tone="urgent"
              to="/requests?filter=urgent"
              icon={<AlertCircle size={18} />}
            />
            <StatCard
              label="NEEDS YOUR DECISION"
              value={String(decisions.length)}
              detail={
                quotes
                  ? `${quotes} vendor ${quotes === 1 ? "quote" : "quotes"} to review`
                  : "Reports, vendors & visits"
              }
              to="/requests?filter=awaiting"
              icon={<ClipboardList size={18} />}
            />
            <StatCard
              label="CONFIRMED VISITS TODAY"
              value={String(data.visitsToday)}
              detail="Today in each property's timezone"
              to="/requests?filter=today"
              icon={<CalendarDays size={18} />}
            />
            <StatCard
              label="NEEDS RESIDENT VERIFICATION"
              value={String(verification)}
              detail="Work completed ≠ problem fixed"
              tone="lime"
              to="/requests?filter=verification"
              icon={<ShieldCheck size={18} />}
            />
          </section>
          <div className="dashboard-grid">
            <section className="surface action-queue">
              <div className="section-title">
                <div>
                  <span className="label">REPAIR OPERATIONS</span>
                  <h2>
                    {queue === "decisions"
                      ? "Move the right work forward."
                      : "See who is responding next."}
                  </h2>
                </div>
                <Link
                  to={`/requests?filter=${queue === "decisions" ? "awaiting" : "open"}`}
                  className="text-button"
                >
                  View all
                  <ArrowRight size={14} />
                </Link>
              </div>
              <div className="queue-switch" aria-label="Action queue views">
                <button
                  aria-pressed={queue === "decisions"}
                  className={queue === "decisions" ? "active" : ""}
                  onClick={() => setQueue("decisions")}
                >
                  Your decisions<span>{decisions.length}</span>
                </button>
                <button
                  aria-pressed={queue === "others"}
                  className={queue === "others" ? "active" : ""}
                  onClick={() => setQueue("others")}
                >
                  Waiting on others<span>{waiting.length}</span>
                </button>
              </div>
              <div className="decision-list">
                {visible.slice(0, 5).map((request) => {
                  const step = nextStep(request);
                  return (
                    <Link
                      to={step.href}
                      className="decision-row"
                      key={request.id}
                    >
                      <span
                        className={`decision-icon ${request.priority === "urgent" ? "urgent" : ""}`}
                      >
                        {request.priority === "urgent" ? (
                          <AlertCircle size={18} />
                        ) : step.owner === "Resident" ? (
                          <ShieldCheck size={18} />
                        ) : (
                          <Wrench size={18} />
                        )}
                      </span>
                      <div className="decision-copy">
                        <div>
                          <span className="record-id" title={request.id}>
                            {displayId(request.id)}
                          </span>
                          {request.priority === "urgent" ? (
                            <span className="priority-chip">Urgent</span>
                          ) : null}
                          <span>
                            {request.property} · Unit {request.unit}
                          </span>
                        </div>
                        <strong>{request.title}</strong>
                        <p>{step.detail}</p>
                        <span className="decision-age">
                          <Clock3 size={12} />
                          {ageLabel(request.createdAt).replace(
                            "open since report",
                            "since report",
                          )}
                        </span>
                      </div>
                      <div className="decision-cta">
                        <span>{step.owner}</span>
                        <strong>
                          {step.title}
                          <ArrowRight size={14} />
                        </strong>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {!visible.length ? (
                <EmptyState
                  title={
                    queue === "decisions"
                      ? "No manager decisions waiting"
                      : "No handoffs waiting"
                  }
                  detail={
                    queue === "decisions"
                      ? "Accepted jobs and resident responses remain visible in Waiting on others."
                      : "The next handoff will appear here when a vendor or resident needs to respond."
                  }
                  action={
                    <Link className="button secondary" to="/requests">
                      Browse requests
                      <ArrowRight size={14} />
                    </Link>
                  }
                />
              ) : null}
              <div className="queue-footnote">
                <ShieldCheck size={14} />
                Priority is a routing aid, not a promised repair deadline.
              </div>
            </section>
            <div className="stack">
              <section className="surface schedule-card">
                <div className="section-title">
                  <div>
                    <span className="label">TODAY'S VISITS</span>
                    <h3>Confirmed, not just proposed.</h3>
                  </div>
                  <CalendarDays size={19} />
                </div>
                {data.schedule.length ? (
                  data.schedule.map((slot) => (
                    <Link
                      className="schedule-row"
                      key={slot.requestId ?? `${slot.time}-${slot.detail}`}
                      to={
                        slot.requestId
                          ? `/requests/${encodeURIComponent(slot.requestId)}?tab=visits`
                          : "/requests?filter=today"
                      }
                    >
                      <span className="schedule-dot" />
                      <div>
                        <strong>
                          {slot.time} · {slot.vendor}
                        </strong>
                        <span>{slot.detail}</span>
                        {slot.timezone ? (
                          <small>{slot.timezone} · property time</small>
                        ) : null}
                      </div>
                      <ArrowRight size={14} />
                    </Link>
                  ))
                ) : (
                  <EmptyState
                    title="No confirmed visits today"
                    detail="A time appears here only after the resident and vendor both confirm."
                    action={
                      <Link
                        className="text-button"
                        to="/requests?filter=scheduled"
                      >
                        Review visits & work
                        <ArrowRight size={14} />
                      </Link>
                    }
                  />
                )}
              </section>
              <section className="memory-card">
                <span className="label lime-text">CLOSE THE LOOP</span>
                <h2>
                  Done by the vendor.
                  <br />
                  Verified by the resident.
                </h2>
                <p>
                  Keep photos, quote history and the resident's response on one
                  repair record. An unresolved repair returns to work.
                </p>
                <Link
                  to="/requests?filter=verification"
                  className="button lime-button"
                >
                  Review outcomes
                  <ArrowRight size={15} />
                </Link>
              </section>
            </div>
          </div>
          {!data.requests.length ? (
            <section className="surface getting-started">
              <div>
                <span className="label">START SIMPLE</span>
                <h3>Set up the first repair workflow.</h3>
                <p>
                  Add a property and a vendor, then report an issue. No
                  integrations are required for basic tracking.
                </p>
              </div>
              <div>
                <Link to="/properties" className="button secondary">
                  <Home size={16} />
                  Properties
                </Link>
                <Link to="/vendors" className="button secondary">
                  <Store size={16} />
                  Vendors
                </Link>
                <Link to="/requests/new" className="button primary">
                  <Plus size={16} />
                  First request
                </Link>
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function Requests() {
  const { t } = useContext(LanguageContext);
  const [params, setParams] = useSearchParams();
  const externalSearch = params.get("search") ?? "";
  const [query, setQuery] = useState(externalSearch);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const filter = params.get("filter") ?? "all";
  const priority = params.get("priority") ?? "";
  const property = params.get("property") ?? "";
  const sortParam = params.get("sort");
  const sort: RequestSort =
    sortParam === "newest" || sortParam === "oldest" || sortParam === "property"
      ? sortParam
      : "attention";
  const board = params.get("view") === "board";
  const {
    data: items,
    loading,
    error,
    refresh,
    lastLoadedAt,
  } = useApiResource(
    useCallback(
      (signal) =>
        api.requests({ search: externalSearch, priority, property }, signal),
      [externalSearch, priority, property],
    ),
    [] as RequestRecord[],
  );
  useEffect(() => setQuery(externalSearch), [externalSearch]);
  useEffect(
    () => setPage(1),
    [externalSearch, priority, property, filter, sort],
  );
  const setParam = (name: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(name, value);
      else next.delete(name);
      return next;
    });
  const visible = useMemo(
    () =>
      sortRequests(
        items.filter((item) => matchesFilter(item, filter)),
        sort,
      ),
    [items, filter, sort],
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / 15));
  const currentPage = Math.min(page, totalPages);
  const paged = visible.slice((currentPage - 1) * 15, currentPage * 15);
  const hasFilters = Boolean(
    externalSearch || priority || property || filter !== "all",
  );
  const clearFilters = () => {
    setQuery("");
    setParams(board ? { view: "board" } : {});
    setPage(1);
  };
  const search = (event: FormEvent) => {
    event.preventDefault();
    setParam("search", query.trim());
  };
  return (
    <>
      <PageHeader
        eyebrow="Maintenance operations"
        title="Every repair. One clear queue."
        description="Filter the work, see the handoff, open the next decision."
        action={
          <div className="button-row">
            <Button
              variant="secondary"
              disabled={loading || Boolean(error) || !visible.length}
              onClick={() => downloadCsv(visible, "repairledger-requests.csv")}
            >
              <Download size={16} />
              Export
            </Button>
            <Link className="button primary" to="/requests/new">
              <Plus size={17} />
              {t("newRequest", "New request")}
            </Link>
          </div>
        }
      />
      {error ? <ErrorNotice message={error} onRetry={refresh} /> : null}
      <section className="surface request-index" aria-label="Request workspace">
        <div className="request-index-header">
          <div>
            <h2>Repair queue</h2>
            <span>
              {loading
                ? "Fetching current records…"
                : error
                  ? "Records unavailable · retry above"
                  : `${visible.length} matching ${visible.length === 1 ? "request" : "requests"}`}
            </span>
          </div>
          <div className="view-switch" aria-label="Request view">
            <button
              aria-pressed={!board}
              className={!board ? "active" : ""}
              onClick={() => setParam("view", "")}
            >
              <List size={15} />
              List
            </button>
            <button
              aria-pressed={board}
              className={board ? "active" : ""}
              onClick={() => setParam("view", "board")}
            >
              <Columns3 size={15} />
              Board
            </button>
          </div>
        </div>
        <div
          className="tabs request-filter-tabs"
          aria-label="Request status filters"
        >
          {requestFilters.map((tab) => (
            <button
              key={tab.id}
              aria-pressed={filter === tab.id}
              className={filter === tab.id ? "active" : ""}
              onClick={() => setParam("filter", tab.id === "all" ? "" : tab.id)}
            >
              {tab.label}
              <span className="tab-count">
                {loading || error
                  ? "—"
                  : items.filter((item) => matchesFilter(item, tab.id)).length}
              </span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <form className="small-search request-search" onSubmit={search}>
            <Search size={15} />
            <input
              aria-label="Search requests"
              value={query}
              maxLength={200}
              placeholder="Search title, property, unit or resident"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              className="search-submit"
              type="submit"
              aria-label="Apply request search"
            >
              <ArrowRight size={16} />
            </button>
          </form>
          <div className="toolbar-controls">
            <label className="sort-control">
              <span className="visually-hidden">Sort requests</span>
              <select
                value={sort}
                onChange={(event) => setParam("sort", event.target.value)}
              >
                <option value="attention">Urgency, then oldest</option>
                <option value="oldest">Oldest report first</option>
                <option value="newest">Newest report first</option>
                <option value="property">Property & unit</option>
              </select>
            </label>
            <Button variant="secondary" onClick={() => setFilterOpen(true)}>
              <Filter size={15} />
              Filters
              {priority || property
                ? ` · ${Number(Boolean(priority)) + Number(Boolean(property))}`
                : ""}
            </Button>
            <button
              className="icon-button refresh-records"
              aria-label="Refresh requests"
              title="Refresh requests"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>
        {hasFilters ? (
          <div className="active-filters" aria-label="Active filters">
            {filter !== "all" ? (
              <button onClick={() => setParam("filter", "")}>
                {requestFilters.find((tab) => tab.id === filter)?.label ??
                  filter}
                <X size={12} />
                <span className="visually-hidden">Clear status filter</span>
              </button>
            ) : null}
            {externalSearch ? (
              <button
                onClick={() => {
                  setQuery("");
                  setParam("search", "");
                }}
              >
                Search: {externalSearch}
                <X size={12} />
                <span className="visually-hidden">Clear search</span>
              </button>
            ) : null}
            {priority ? (
              <button onClick={() => setParam("priority", "")}>
                Priority: {priority}
                <X size={12} />
                <span className="visually-hidden">Clear priority filter</span>
              </button>
            ) : null}
            {property ? (
              <button onClick={() => setParam("property", "")}>
                Property: {property}
                <X size={12} />
                <span className="visually-hidden">Clear property filter</span>
              </button>
            ) : null}
            <button className="clear-filters" onClick={clearFilters}>
              Reset filters
            </button>
          </div>
        ) : null}
        {loading ? (
          <LoadingState label="Loading requests…" />
        ) : error ? (
          <div className="data-state-note">
            Current records could not be loaded. Previously loaded records are
            not shown as a live queue.
          </div>
        ) : visible.length ? (
          board ? (
            <>
              <p className="board-help">
                Open a card for the next step. Status changes use validated
                actions inside the repair record.
              </p>
              <RequestBoard items={visible} />
            </>
          ) : (
            <RequestTable items={paged} />
          )
        ) : (
          <EmptyState
            title={
              hasFilters
                ? "No requests match these filters"
                : "Your repair queue starts here"
            }
            detail={
              hasFilters
                ? "Clear a filter to find the work you're looking for."
                : "Report an issue to start a traceable repair workflow."
            }
            action={
              <div className="button-row">
                {hasFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Reset filters
                  </Button>
                ) : null}
                <Link className="button primary" to="/requests/new">
                  New request
                  <Plus size={14} />
                </Link>
              </div>
            }
          />
        )}
        {!loading && !error ? (
          <footer className="request-index-footer">
            <span>
              {lastLoadedAt
                ? `Fetched ${lastLoadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : ""}{" "}
              · counts reflect current filters
            </span>
            {!board && visible.length ? (
              <div className="pagination">
                <span>
                  {(currentPage - 1) * 15 + 1}–
                  {Math.min(currentPage * 15, visible.length)} of{" "}
                  {visible.length}
                </span>
                <button
                  className="button secondary"
                  aria-label="Previous requests page"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  className="button secondary"
                  aria-label="Next requests page"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : null}
          </footer>
        ) : null}
      </section>
      {filterOpen ? (
        <FilterDrawer
          priority={priority}
          property={property}
          onClose={() => setFilterOpen(false)}
          onApply={(next) => {
            setParams((current) => {
              const updated = new URLSearchParams(current);
              for (const [name, value] of Object.entries(next)) {
                if (value) updated.set(name, value);
                else updated.delete(name);
              }
              return updated;
            });
            setFilterOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
function RequestTable({ items }: { items: RequestRecord[] }) {
  return (
    <>
      <div className="table-wrap repair-table">
        <table>
          <caption className="visually-hidden">
            Repairs, next responsible person and action
          </caption>
          <thead>
            <tr>
              <th scope="col">REPAIR / PRIORITY</th>
              <th scope="col">PROPERTY & UNIT</th>
              <th scope="col">STATUS</th>
              <th scope="col">NEXT HANDOFF</th>
              <th scope="col">REPORTED</th>
              <th scope="col">
                <span className="visually-hidden">Open next step</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const step = nextStep(item);
              return (
                <tr key={item.id}>
                  <td>
                    <Link
                      to={`/requests/${encodeURIComponent(item.id)}`}
                      className="table-primary"
                    >
                      <span className="record-id" title={item.id}>
                        {displayId(item.id)}
                        {item.priority === "urgent" ? (
                          <span className="priority-chip">Urgent</span>
                        ) : null}
                      </span>
                      <strong>{item.title}</strong>
                    </Link>
                  </td>
                  <td>
                    <div className="table-location">
                      <strong>
                        {item.property} · {item.unit}
                      </strong>
                      <span>
                        {item.assignedVendorName ?? "No vendor assigned"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <RequestStatus request={item} />
                  </td>
                  <td>
                    <div className="table-next">
                      <span>
                        {step.owner === "None"
                          ? "Outcome recorded"
                          : step.owner}
                      </span>
                      <Link to={step.href}>{step.title}</Link>
                    </div>
                  </td>
                  <td>
                    <span
                      className="table-age"
                      title={formatDate(item.createdAt, item.timezone)}
                    >
                      {ageLabel(item.createdAt).replace(
                        "open since report",
                        "since report",
                      )}
                    </span>
                  </td>
                  <td>
                    <Link
                      to={step.href}
                      className="row-open"
                      aria-label={`Open next step for ${item.id}`}
                    >
                      <ArrowRight size={16} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mobile-repair-cards">
        {items.map((item) => (
          <RequestCard key={item.id} request={item} />
        ))}
      </div>
    </>
  );
}
function FilterDrawer({
  priority,
  property,
  onClose,
  onApply,
}: {
  priority: string;
  property: string;
  onClose: () => void;
  onApply: (filters: { priority: string; property: string }) => void;
}) {
  const [draftPriority, setDraftPriority] = useState(priority);
  const [draftProperty, setDraftProperty] = useState(property);
  const overlayRef = useOverlayFocus<HTMLElement>(true, onClose);
  const {
    data: properties,
    loading,
    error,
    refresh,
  } = useApiResource(
    useCallback((signal) => api.properties(signal), []),
    [] as PropertyRecord[],
  );
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer filter-drawer"
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filter requests"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <span className="label">FILTER REQUESTS</span>
            <h2>Find the right work.</h2>
            <p className="muted">
              Choose filters, then apply. Closing leaves the queue unchanged.
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Close filters"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {error ? <ErrorNotice message={error} onRetry={refresh} /> : null}
        <div className="form-grid">
          <label>
            Priority
            <select
              value={draftPriority}
              onChange={(event) => setDraftPriority(event.target.value)}
            >
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="routine">Routine</option>
            </select>
          </label>
          <label>
            Property
            <select
              value={draftProperty}
              disabled={loading || Boolean(error)}
              onChange={(event) => setDraftProperty(event.target.value)}
            >
              <option value="">
                {loading ? "Loading properties…" : "All properties"}
              </option>
              {properties.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="drawer-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setDraftPriority("");
              setDraftProperty("");
            }}
          >
            Clear selection
          </Button>
          <Button
            onClick={() =>
              onApply({ priority: draftPriority, property: draftProperty })
            }
          >
            Apply filters
          </Button>
        </div>
      </aside>
    </div>
  );
}

function NewRequest() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    property: "",
    unit: "",
    resident: "",
    category: "Plumbing",
    description: "",
    priority: "routine",
    access: "Resident must be home",
    accessNotes: "",
    preferredWindow: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  useEffect(() => {
    api
      .properties()
      .then(({ data }) => {
        setProperties(data);
        setForm((current) => ({ ...current, property: data[0]?.name ?? "" }));
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Property list unavailable.",
        ),
      );
  }, []);
  const update = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { data } = await api.createRequest({
        ...form,
        priority: form.priority as "urgent" | "routine",
        language: "en-US",
      });
      navigate(`/requests/${data.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Request could not be created",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div className="crumb">
        <Link to="/requests">
          <ArrowLeft size={15} /> Requests
        </Link>
        <span>/</span>
        <span>New request</span>
      </div>
      <PageHeader
        eyebrow="Operations"
        title="Create a maintenance request"
        description="Capture enough context for a safe first visit."
      />
      {error ? <ErrorNotice message={error} onRetry={() => undefined} /> : null}
      <form className="surface form-card" onSubmit={submit}>
        <div className="form-section">
          <span className="label">REQUEST DETAILS</span>
          <h2>What needs attention?</h2>
          <div className="form-grid two">
            <label>
              Title
              <input
                required
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="e.g. Kitchen sink leak"
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(event) => update("category", event.target.value)}
              >
                <option>Plumbing</option>
                <option>Heating or cooling</option>
                <option>Electrical</option>
                <option>Appliances</option>
                <option>Something else</option>
              </select>
            </label>
            <label>
              Property
              <select
                value={form.property}
                onChange={(event) => update("property", event.target.value)}
              >
                {properties
                  .map((property) => property.name)
                  .map((name) => (
                    <option key={name}>{name}</option>
                  ))}
              </select>
            </label>
            <label>
              Unit
              <input
                required
                value={form.unit}
                onChange={(event) => update("unit", event.target.value)}
              />
            </label>
            <label>
              Resident
              <input
                value={form.resident}
                onChange={(event) => update("resident", event.target.value)}
                placeholder="Resident name"
              />
            </label>
            <label>
              Priority
              <select
                value={form.priority}
                onChange={(event) => update("priority", event.target.value)}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              required
              rows={5}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Describe what is happening, when it started and any immediate risks."
            />
          </label>
        </div>
        <div className="form-section">
          <span className="label">ACCESS AND TIMING</span>
          <div className="form-grid two">
            <label>
              Permission
              <select
                value={form.access}
                onChange={(event) => update("access", event.target.value)}
              >
                <option>Resident must be home</option>
                <option>Anytime with notice</option>
                <option>Use the lockbox</option>
              </select>
            </label>
            <label>
              Preferred visit
              <select
                value={form.preferredWindow}
                onChange={(event) =>
                  update("preferredWindow", event.target.value)
                }
              >
                <option value="">Not specified</option>
                <option>Today · 10 AM–12 PM</option>
                <option>Today · 2–4 PM</option>
                <option>Tomorrow · 9–11 AM</option>
              </select>
            </label>
          </div>
          <label>
            Access notes
            <input
              value={form.accessNotes}
              onChange={(event) => update("accessNotes", event.target.value)}
              placeholder="Pets, gate instructions or call-on-arrival details"
            />
          </label>
        </div>
        <div className="drawer-actions">
          <Link className="button secondary" to="/requests">
            Cancel
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create request"} <ArrowRight size={16} />
          </Button>
        </div>
      </form>
    </>
  );
}

function RequestWorkspace() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data: detail,
    setData: setDetail,
    loading,
    error,
    refresh: load,
  } = useApiResource(
    useCallback((signal) => api.request(id, signal), [id]),
    null as RequestDetail | null,
  );
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"saving" | "success" | "error">(
    "success",
  );
  const [reviewEstimateId, setReviewEstimateId] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const tab = searchParams.get("tab") ?? "overview";
  if (loading) return <LoadingState label="Loading request workspace…" />;
  if (error || !detail)
    return (
      <ErrorNotice message={error || "Request not found"} onRetry={load} />
    );
  const transition = async (state: RequestState, note: string) => {
    setNoticeTone("saving");
    setNotice("Saving workflow change…");
    try {
      const { data } = await api.transitionRequest(id, state, note);
      setDetail(data);
      setNoticeTone("success");
      setNotice("Workflow updated");
      setStatusOpen(false);
    } catch (reason) {
      setNoticeTone("error");
      setNotice(
        reason instanceof Error ? reason.message : "Workflow update failed",
      );
    }
  };
  const proposeVisit = async (
    localStart: string,
    durationMinutes: number,
    timezone: string,
  ) => {
    const { data } = await api.proposeAppointment(id, {
      localStart,
      durationMinutes,
      timezone,
    });
    setDetail(data);
  };
  const approveEstimate = async (estimateId: string) => {
    try {
      const { data } = await api.approveEstimate(id, estimateId);
      setDetail(data);
      setNoticeTone("success");
      setNotice("Quote approved. Work can start within this scope and limit.");
    } catch (reason) {
      setNoticeTone("error");
      setNotice(
        reason instanceof Error ? reason.message : "Quote approval failed",
      );
    }
  };
  const requestEstimateChanges = async (estimateId: string) => {
    setReviewEstimateId(estimateId);
    setReviewNote("");
    setNotice("");
  };
  const saveQuoteChanges = async (event: FormEvent) => {
    event.preventDefault();
    if (!reviewEstimateId || !reviewNote.trim() || reviewSaving) return;
    setReviewSaving(true);
    try {
      const { data } = await api.requestEstimateChanges(
        id,
        reviewEstimateId,
        reviewNote.trim(),
      );
      setDetail(data);
      setNoticeTone("success");
      setNotice("Quote returned to the vendor with your clarification note.");
      setReviewEstimateId("");
    } catch (reason) {
      setNoticeTone("error");
      setNotice(
        reason instanceof Error
          ? reason.message
          : "Your note could not be saved.",
      );
    } finally {
      setReviewSaving(false);
    }
  };
  const setTab = (next: string) =>
    setSearchParams((current) => {
      current.set("tab", next);
      return current;
    });
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "messages", label: "Messages" },
    { id: "visits", label: "Visits" },
    { id: "work-orders", label: "Work orders" },
    { id: "costs", label: "Costs" },
    { id: "evidence", label: "Evidence" },
    { id: "audit", label: "Audit" },
  ];
  const step = nextStep(detail);
  const attention = managerAction(detail);
  return (
    <>
      <div className="crumb">
        <Link to="/requests">
          <ArrowLeft size={15} /> Requests
        </Link>
        <span>/</span>
        <span>{detail.id}</span>
      </div>
      <PageHeader
        eyebrow={demoMode ? "Sample workspace · demo data" : "Repair record"}
        title={detail.title}
        description={`${detail.id} · ${detail.property} · Unit ${detail.unit}`}
        action={
          <div className="button-row">
            <Button variant="secondary" onClick={() => setTab("messages")}>
              <MessageCircle size={16} /> Message
            </Button>
            <Button onClick={() => setStatusOpen(true)}>
              Update status <ChevronDown size={15} />
            </Button>
          </div>
        }
      />
      {notice ? (
        <div
          className={noticeTone === "error" ? "notice danger" : "toast"}
          role={noticeTone === "error" ? "alert" : "status"}
        >
          {noticeTone === "error" ? (
            <AlertCircle size={16} />
          ) : noticeTone === "saving" ? (
            <RefreshCw size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}
          {notice}
        </div>
      ) : null}
      <RepairProgress request={detail} />
      <div className="request-layout">
        <div className="request-main">
          <div className="workspace-tabs">
            {tabs.map((item) => (
              <button
                key={item.id}
                aria-pressed={tab === item.id}
                className={tab === item.id ? "active" : ""}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {tab === "overview" ? <OverviewPanel detail={detail} /> : null}
          {tab === "messages" ? <MessagesPanel id={id} /> : null}
          {tab === "visits" ? (
            <VisitsPanel detail={detail} onPropose={proposeVisit} />
          ) : null}
          {tab === "work-orders" ? <WorkOrderPanel detail={detail} /> : null}
          {tab === "costs" ? (
            <CostsPanel
              detail={detail}
              onApprove={approveEstimate}
              onRequestChanges={requestEstimateChanges}
            />
          ) : null}
          {tab === "evidence" ? (
            <EvidencePanel detail={detail} onUploaded={load} />
          ) : null}
          {tab === "audit" ? (
            <section className="surface timeline-card">
              <div className="section-title">
                <div>
                  <span className="label">AUDIT LOG</span>
                  <h3>Every change is traceable</h3>
                </div>
              </div>
              <Timeline events={detail.events ?? []} />
            </section>
          ) : null}
        </div>
        <aside className="decision-panel">
          <div className="owner-chip">
            <Users size={14} />
            {step.owner === "None" ? "Outcome recorded" : `Next: ${step.owner}`}
          </div>
          <span className="label lime-text">NEXT STEP</span>
          <h2>{step.title}</h2>
          <p>{step.detail}</p>
          <div className="panel-facts">
            <Fact
              label="VENDOR"
              value={detail.assignedVendorName ?? "Not assigned"}
            />
            <Fact
              label="RESIDENT"
              value={`${detail.resident} · ${detail.language}`}
            />
            <Fact label="ACCESS" value={detail.access} />
          </div>
          {attention === "acknowledge" ? (
            <button
              className="button lime-button full"
              onClick={() => setStatusOpen(true)}
            >
              <Check size={15} />
              Acknowledge report
            </button>
          ) : attention === "assign" ? (
            <Link className="button lime-button full" to={step.href}>
              <Users size={15} />
              {step.title}
            </Link>
          ) : (
            <Link className="button lime-button full" to={step.href}>
              <ArrowRight size={15} />
              {attention
                ? step.title
                : step.owner === "None"
                  ? "View repair history"
                  : "Review this handoff"}
            </Link>
          )}
          <Button variant="secondary" onClick={() => setTab("messages")}>
            <MessageCircle size={16} />
            Open repair conversation
          </Button>
          <p className="decision-context">
            Reported {formatDate(detail.createdAt, detail.timezone)}. Status and
            ownership are derived from the workflow, not a promised SLA.
          </p>
        </aside>
      </div>
      {reviewEstimateId ? (
        <Modal
          title="Request quote clarification"
          onClose={() => {
            if (!reviewSaving) setReviewEstimateId("");
          }}
        >
          <p className="modal-help">
            Keep the approval decision traceable. Tell the vendor exactly what
            scope or cost needs to change.
          </p>
          {noticeTone === "error" && notice ? (
            <div className="notice danger" role="alert">
              {notice}
            </div>
          ) : null}
          <form onSubmit={(event) => void saveQuoteChanges(event)}>
            <label>
              Your note
              <textarea
                rows={4}
                minLength={3}
                maxLength={1000}
                required
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="For example: separate the replacement part cost and confirm whether the old fitting is included."
              />
            </label>
            <div className="drawer-actions">
              <Button
                variant="secondary"
                disabled={reviewSaving}
                onClick={() => setReviewEstimateId("")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={reviewSaving || reviewNote.trim().length < 3}
              >
                {reviewSaving ? "Saving…" : "Return quote with note"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
      {statusOpen ? (
        <StatusModal
          current={detail.state}
          onClose={() => setStatusOpen(false)}
          onSave={transition}
        />
      ) : null}
    </>
  );
}
function OverviewPanel({ detail }: { detail: RequestDetail }) {
  return (
    <>
      <section className="surface request-card">
        <div className="status-line">
          <div className="button-row">
            <Pill tone={detail.priority === "urgent" ? "urgent" : "gold"}>
              {detail.priority}
            </Pill>
            <span className="muted">
              Reported {formatDate(detail.createdAt, detail.timezone)}
            </span>
          </div>
          <RequestStatus request={detail} />
        </div>
        <div className="request-intro">
          <div>
            <span className="label">REPAIR OUTCOME</span>
            <h2>{detail.title}</h2>
            <p>{detail.description}</p>
          </div>
          <div className="deadline-card">
            <Clock3 size={17} />
            <div>
              <strong>{nextStep(detail).owner} · next step</strong>
              <span>{nextStep(detail).title}</span>
            </div>
          </div>
        </div>
        {detail.photoUrl ? (
          <img
            className="request-photo"
            src={detail.photoUrl}
            alt="Repair evidence"
          />
        ) : null}
        <div className="fact-grid">
          <Fact
            label="RESIDENT"
            value={`${detail.resident} · ${detail.language}`}
          />
          <Fact label="ACCESS" value={detail.access} />
          <Fact
            label="AVAILABLE"
            value={detail.preferredWindow ?? "Not confirmed"}
          />
          <Fact
            label="VENDOR"
            value={detail.assignedVendorName ?? "Not assigned"}
          />
        </div>
      </section>
      <section className="surface timeline-card">
        <div className="section-title">
          <div>
            <span className="label">REPAIR HISTORY</span>
            <h3>What has happened</h3>
          </div>
          <Link className="text-button" to={`/requests/${detail.id}?tab=audit`}>
            View audit <ArrowRight size={14} />
          </Link>
        </div>
        <Timeline events={detail.events ?? []} />
      </section>
    </>
  );
}
function StatusModal({
  current,
  onClose,
  onSave,
}: {
  current: RequestState;
  onClose: () => void;
  onSave: (state: RequestState, note: string) => Promise<void> | void;
}) {
  const [state, setState] = useState<RequestState>(
    current === "submitted" || current === "urgent" ? "acknowledged" : current,
  );
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const nextStates: Partial<Record<RequestState, RequestState[]>> = {
    submitted: ["acknowledged", "waiting", "cancelled"],
    urgent: ["acknowledged", "waiting", "cancelled"],
    acknowledged: ["assigned", "waiting", "cancelled"],
    assigned: ["acknowledged", "waiting", "cancelled"],
    scheduled: ["assigned", "waiting", "cancelled"],
    approved: ["waiting", "cancelled"],
    waiting: ["acknowledged", "assigned", "cancelled"],
    in_progress: ["waiting", "cancelled"],
  };
  const options = [current, ...(nextStates[current] ?? [])];
  return (
    <Modal
      title="Update repair status"
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <p className="modal-help">
        Appointments, quote approval, work completion, and resident verification
        have their own recorded actions.
      </p>
      <label>
        New status
        <select
          value={state}
          disabled={saving}
          onChange={(event) => setState(event.target.value as RequestState)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {formatState(option)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Internal note
        <textarea
          rows={3}
          maxLength={1000}
          disabled={saving}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Why is the request moving?"
        />
      </label>
      <div className="drawer-actions">
        <Button variant="secondary" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={
            saving ||
            state === current ||
            !(nextStates[current] ?? []).includes(state)
          }
          onClick={async () => {
            if (saving) return;
            setSaving(true);
            try {
              await onSave(
                state,
                note || `State changed to ${formatState(state)}`,
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save status"}
        </Button>
      </div>
    </Modal>
  );
}
function MessagesPanel({ id }: { id: string }) {
  const {
    data: messages,
    setData: setMessages,
    loading,
    error,
    setError,
    refresh: load,
  } = useApiResource(
    useCallback((signal) => api.messages(id, signal), [id]),
    [] as MessageRecord[],
  );
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentStatus, setAttachmentStatus] = useState("");
  const [uploadedAttachmentId, setUploadedAttachmentId] = useState("");
  const [sending, setSending] = useState(false);
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() && !attachment) return;
    setSending(true);
    setError("");
    try {
      if (attachment && !uploadedAttachmentId) {
        const uploaded = await api.uploadEvidence(attachment, id);
        setUploadedAttachmentId(uploaded.data.evidenceId);
        setAttachmentStatus("Evidence linked to this repair");
      }
      const messageBody = `${body.trim()}${attachment ? `${body.trim() ? "\n\n" : ""}Evidence uploaded to this repair: ${attachment.name}` : ""}`;
      const { data } = await api.sendMessage(id, messageBody);
      setMessages((current) => [...current, data]);
      setBody("");
      setUploadedAttachmentId("");
      setAttachment(null);
      setAttachmentStatus("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Message could not be sent",
      );
    } finally {
      setSending(false);
    }
  };
  return (
    <section className="surface conversation">
      <div className="section-title">
        <div>
          <span className="label">MESSAGES</span>
          <h3>Resident and vendor conversation</h3>
        </div>
        <Pill tone="lime">Originals preserved</Pill>
      </div>
      {error ? <ErrorNotice message={error} onRetry={load} /> : null}
      {loading ? (
        <LoadingState label="Loading conversation…" />
      ) : (
        <div className="message-thread">
          {messages.length ? (
            messages.map((message) => (
              <div
                className={`message-bubble ${message.role === "manager" ? "outgoing" : ""}`}
                key={message.id}
              >
                <div>
                  <strong>{message.sender}</strong>
                  <time>{message.at}</time>
                </div>
                <p>{message.body}</p>
                {message.translatedBody &&
                message.translatedBody !== message.body ? (
                  <small>{message.translatedBody}</small>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState
              title="No messages yet"
              detail="Start the conversation with the resident or vendor."
            />
          )}
        </div>
      )}
      <form className="composer" onSubmit={send}>
        <textarea
          aria-label="Message"
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a clear update…"
        />
        <div className="composer-actions">
          <label
            className="icon-button"
            aria-label="Attach a file to the repair"
          >
            <Paperclip size={17} />
            <input
              className="visually-hidden"
              type="file"
              accept="image/*,video/mp4,video/quicktime,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file) {
                  try {
                    validateEvidence(file);
                  } catch (reason) {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "Invalid file.",
                    );
                    return;
                  }
                }
                setUploadedAttachmentId("");
                setAttachment(file);
              }}
            />
          </label>
          {attachment ? (
            <span className="attachment-status">
              Will upload with message · {attachment.name}
            </span>
          ) : attachmentStatus ? (
            <span className="attachment-status">{attachmentStatus}</span>
          ) : null}
          <Button
            type="submit"
            disabled={sending || (!body.trim() && !attachment)}
          >
            {sending ? "Sending…" : "Send message"} <Send size={15} />
          </Button>
        </div>
      </form>
    </section>
  );
}
function VisitsPanel({
  detail,
  onPropose,
}: {
  detail: RequestDetail;
  onPropose: (
    localStart: string,
    durationMinutes: number,
    timezone: string,
  ) => Promise<void>;
}) {
  const timezone = detail.timezone ?? detail.appointment?.timezone ?? "UTC";
  const [date, setDate] = useState(() =>
    propertyDateInput(timezone, new Date(Date.now() + 86_400_000)),
  );
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const canPropose =
    detail.vendorDecision === "accepted" &&
    detail.estimate?.status === "approved" &&
    [
      "submitted",
      "urgent",
      "acknowledged",
      "assigned",
      "approved",
      "scheduled",
      "waiting",
    ].includes(detail.state);
  const schedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!canPropose || saving) return;
    setSaving(true);
    setNotice("");
    setFailed(false);
    try {
      await onPropose(`${date}T${time}`, duration, timezone);
      setNotice(
        "Visit proposed. Both the resident and vendor must confirm it.",
      );
    } catch (reason) {
      setFailed(true);
      setNotice(
        reason instanceof Error
          ? reason.message
          : "Appointment could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="surface detail-panel">
      <div className="section-title">
        <div>
          <span className="label">VISIT COORDINATION</span>
          <h3>A clear time. Two confirmations.</h3>
        </div>
      </div>
      {detail.appointment ? (
        <VisitConfirmation appointment={detail.appointment} />
      ) : (
        <EmptyState
          title="No visit proposed yet"
          detail="Accept the vendor and approve the quote before proposing a time."
        />
      )}
      {canPropose ? (
        <form onSubmit={(event) => void schedule(event)}>
          <div className="form-grid two">
            <label>
              Proposed visit date
              <input
                type="date"
                min={propertyDateInput(timezone)}
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label>
              Proposed start time
              <input
                type="time"
                required
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
            <label>
              Visit duration
              <select
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={240}>4 hours</option>
              </select>
            </label>
            <Fact label="PROPERTY TIMEZONE" value={timezone} />
          </div>
          <div className="notice">
            <CalendarDays size={18} />
            <div>
              <strong>Access: {detail.access}</strong>
              <span>
                {detail.accessNotes || "No additional access notes."}{" "}
                {detail.appointment && detail.appointment.status !== "cancelled"
                  ? "A new proposal replaces the current time and resets both confirmations."
                  : "This is a proposal, not a booked appointment."}
              </span>
            </div>
          </div>
          {notice ? (
            <div
              className={failed ? "notice danger" : "notice success"}
              role={failed ? "alert" : "status"}
            >
              {failed ? <AlertCircle size={16} /> : <Check size={16} />}
              <span>{notice}</span>
            </div>
          ) : null}
          <Button type="submit" disabled={saving || !date || !time}>
            <CalendarDays size={16} />
            {saving
              ? "Saving…"
              : detail.appointment
                ? "Propose a new visit time"
                : "Propose visit time"}
          </Button>
        </form>
      ) : (
        <div className="notice">
          <ShieldCheck size={18} />
          <div>
            <strong>Scheduling has prerequisites</strong>
            <span>
              {[
                "closed",
                "cancelled",
                "verification",
                "completed",
                "in_progress",
              ].includes(detail.state)
                ? "This repair is not currently available for a new visit proposal."
                : detail.vendorDecision !== "accepted"
                  ? "The assigned vendor must accept the job first."
                  : "A manager must approve the latest quote first."}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
function WorkOrderPanel({ detail }: { detail: RequestDetail }) {
  const approved = detail.estimate?.status === "approved";
  return (
    <section className="surface detail-panel">
      <div className="section-title">
        <div>
          <span className="label">WORK ORDER</span>
          <h3>Approved scope stays visible</h3>
        </div>
        <Pill tone={approved ? "green" : "gold"}>
          {approved ? "Scope approved" : "Approval required"}
        </Pill>
      </div>
      <div className="fact-grid">
        <Fact label="REQUEST" value={detail.id} />
        <Fact
          label="VENDOR"
          value={detail.assignedVendorName ?? "Awaiting assignment"}
        />
        <Fact
          label="APPROVED SCOPE"
          value={approved ? detail.estimate!.scope : "No approved scope"}
        />
        <Fact
          label="APPROVED LIMIT"
          value={
            approved
              ? money(detail.estimate!.total, detail.estimate!.currency)
              : "Not approved"
          }
        />
      </div>
      <div className="notice">
        <Wrench size={18} />
        <div>
          <strong>
            {approved
              ? "Waiting for vendor check-in"
              : "Work is not authorized yet"}
          </strong>
          <span>
            {approved
              ? "The assigned vendor can start only within this approved scope and amount. Work is not marked started by the landlord."
              : "A landlord must approve a quote before work can start."}
          </span>
        </div>
      </div>
    </section>
  );
}
function CostsPanel({
  detail,
  onApprove,
  onRequestChanges,
}: {
  detail: RequestDetail;
  onApprove: (estimateId: string) => Promise<void>;
  onRequestChanges: (estimateId: string) => Promise<void>;
}) {
  const [reviewing, setReviewing] = useState(false);
  const estimates = detail.estimates?.length
    ? detail.estimates
    : detail.estimate
      ? [detail.estimate]
      : [];
  const latest = estimates[estimates.length - 1];
  return (
    <section className="surface detail-panel">
      <div className="section-title">
        <div>
          <span className="label">COSTS</span>
          <h3>Quote versions and approvals</h3>
        </div>
        <Pill tone={latest?.status === "approved" ? "lime" : "gold"}>
          {latest ? formatState(latest.status) : "No quote"}
        </Pill>
      </div>
      {latest ? (
        <>
          <div className="estimate-summary">
            <div>
              <span>Quote total</span>
              <strong>{money(latest.total, latest.currency)}</strong>
            </div>
            <div>
              <span>Labor</span>
              <strong>{money(latest.labor, latest.currency)}</strong>
            </div>
            <div>
              <span>Parts</span>
              <strong>{money(latest.parts, latest.currency)}</strong>
            </div>
            <div>
              <span>Tax</span>
              <strong>{money(latest.tax, latest.currency)}</strong>
            </div>
          </div>
          <p className="muted">{latest.scope}</p>
          <div className="timeline">
            {estimates.map((estimate) => (
              <div className="timeline-event" key={estimate.id}>
                <div className="timeline-marker">
                  <span />
                </div>
                <div>
                  <strong>
                    Version {estimate.version} · {formatState(estimate.status)}
                  </strong>
                  <span>
                    {money(estimate.total, estimate.currency)} ·{" "}
                    {estimate.scope}
                  </span>
                  {estimate.approvedBy ? (
                    <small>Approved by {estimate.approvedBy}</small>
                  ) : null}
                </div>
                <time>{new Date(estimate.createdAt).toLocaleString()}</time>
              </div>
            ))}
          </div>
          {latest.status === "submitted" &&
          managerAction(detail) === "review_quote" ? (
            <div className="button-row">
              <Button
                disabled={reviewing}
                onClick={async () => {
                  if (reviewing) return;
                  setReviewing(true);
                  try {
                    await onApprove(latest.id);
                  } finally {
                    setReviewing(false);
                  }
                }}
              >
                {reviewing ? "Saving…" : "Approve latest quote"}
              </Button>
              <Button
                variant="secondary"
                disabled={reviewing}
                onClick={() => void onRequestChanges(latest.id)}
              >
                Request changes
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No quote yet"
          detail="The assigned vendor can submit a quote for review."
        />
      )}
    </section>
  );
}
function EvidencePanel({
  detail,
  onUploaded,
}: {
  detail: RequestDetail;
  onUploaded: () => void;
}) {
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const preview = useObjectUrl(previewFile);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [links, setLinks] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    Promise.all(
      (detail.evidence ?? [])
        .filter((item) => item.status === "uploaded")
        .map(async (item) => {
          try {
            const { data } = await api.evidenceUrl(detail.id, item.id);
            return [item.id, data.url] as const;
          } catch {
            return [item.id, ""] as const;
          }
        }),
    ).then((items) => {
      if (active) setLinks(Object.fromEntries(items.filter(([, url]) => url)));
    });
    return () => {
      active = false;
    };
  }, [detail.id, detail.evidence]);
  const selectFile = async (file?: File) => {
    if (!file) return;
    try {
      validateEvidence(file);
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Invalid file.");
      return;
    }
    setPreviewFile(file);
    setUploading(true);
    setStatus(
      demoMode
        ? "Local preview only; this demo does not persist uploads."
        : "Uploading and verifying evidence…",
    );
    try {
      if (!demoMode) {
        await api.uploadEvidence(file, detail.id);
        setStatus("Uploaded and linked to this repair.");
        onUploaded();
      }
    } catch (reason) {
      setStatus(
        reason instanceof Error
          ? reason.message
          : "Evidence could not be saved.",
      );
    } finally {
      setUploading(false);
    }
  };
  return (
    <section className="surface detail-panel">
      <div className="section-title">
        <div>
          <span className="label">EVIDENCE</span>
          <h3>Files linked to this repair</h3>
        </div>
        <label className={`button secondary ${uploading ? "disabled" : ""}`}>
          <Upload size={15} /> {uploading ? "Uploading…" : "Add evidence"}
          <input
            className="visually-hidden"
            type="file"
            accept="image/*,video/mp4,video/quicktime,application/pdf"
            disabled={uploading}
            onChange={(event) => {
              void selectFile(event.target.files?.[0]);
            }}
          />
        </label>
      </div>
      {preview && previewFile?.type.startsWith("image/") ? (
        <img
          className="evidence-preview"
          src={preview}
          alt="Selected repair evidence preview"
        />
      ) : preview && previewFile?.type.startsWith("video/") ? (
        <video className="evidence-preview" src={preview} controls />
      ) : preview ? (
        <p>{previewFile?.name} · PDF selected</p>
      ) : null}
      {(detail.evidence ?? [])
        .filter((item) => item.status === "uploaded")
        .map((item) => (
          <div className="notice" key={item.id}>
            <Paperclip size={18} />
            <div>
              <strong>{item.name}</strong>
              <span>
                {(item.size / 1024 / 1024).toFixed(1)} MB · uploaded by{" "}
                {item.uploadedBy}
              </span>
            </div>
            {links[item.id] ? (
              <a
                className="text-button"
                href={links[item.id]}
                target="_blank"
                rel="noreferrer"
              >
                Open file
              </a>
            ) : null}
          </div>
        ))}
      {!preview && !(detail.evidence ?? []).length ? (
        <EmptyState
          title="No evidence yet"
          detail="Add a photo, video, or invoice. It will be linked to this repair."
        />
      ) : null}
      {status ? (
        <div className="notice">
          <Paperclip size={18} />
          <div>
            <strong>{demoMode ? "Demo evidence" : "Upload status"}</strong>
            <span>{status}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Vendors() {
  const {
    data: items,
    setData: setItems,
    loading,
    error,
    refresh: load,
  } = useApiResource(
    useCallback((signal) => api.vendors(signal), []),
    [] as VendorRecord[],
  );
  const [inviteOpen, setInviteOpen] = useState(false);
  const [offerVendor, setOfferVendor] = useState<VendorRecord | null>(null);
  const [profileVendor, setProfileVendor] = useState<VendorRecord | null>(null);
  const query = new URLSearchParams(useLocation().search).get("request");
  return (
    <>
      <PageHeader
        eyebrow="Network"
        title="Vendors"
        description="Trusted trades and observed performance."
        action={
          <Button onClick={() => setInviteOpen(true)}>
            <Plus size={17} /> Invite vendor
          </Button>
        }
      />
      {error ? <ErrorNotice message={error} onRetry={load} /> : null}
      {query ? (
        <div className="context-banner">
          <AlertCircle size={17} />
          <div>
            <strong>Assigning for {query}</strong>
            <span>Diagnosis only · Resident must be home · Today</span>
          </div>
          <Link aria-label="Close assignment context" to={`/requests/${query}`}>
            <X size={17} />
          </Link>
        </div>
      ) : null}
      <section className="surface vendor-list">
        <div className="section-title">
          <div>
            <span className="label">ELIGIBLE TODAY</span>
            <h2>Choose with evidence</h2>
          </div>
          <span className="muted">{items.length} vendors</span>
        </div>
        {loading ? (
          <LoadingState label="Loading vendors…" />
        ) : items.length ? (
          items.map((vendor) => (
            <div className="vendor-row" key={vendor.id}>
              <div className="vendor-avatar">{vendor.name.slice(0, 1)}</div>
              <button
                className="vendor-info vendor-link"
                onClick={() => setProfileVendor(vendor)}
              >
                <strong>{vendor.name}</strong>
                <span>
                  {vendor.trade} · {vendor.distance}
                </span>
              </button>
              <div className="vendor-evidence">
                <strong>{vendor.availability}</strong>
                <span>{vendor.firstVisitFixes}</span>
              </div>
              <Pill
                tone={
                  vendor.status === "preferred"
                    ? "lime"
                    : vendor.status === "approved"
                      ? "green"
                      : "gold"
                }
              >
                {vendor.status}
              </Pill>
              <Button
                variant={vendor.status === "review" ? "secondary" : "primary"}
                onClick={() =>
                  vendor.status === "review"
                    ? setProfileVendor(vendor)
                    : setOfferVendor(vendor)
                }
              >
                {vendor.status === "review" ? "Review" : "Offer job"}{" "}
                <ArrowRight size={14} />
              </Button>
            </div>
          ))
        ) : (
          <EmptyState
            title="No vendors yet"
            detail="Invite a trusted vendor to start building the network."
            action={
              <Button onClick={() => setInviteOpen(true)}>Invite vendor</Button>
            }
          />
        )}
      </section>
      {inviteOpen ? (
        <InviteVendorModal
          onClose={() => setInviteOpen(false)}
          onCreated={(vendor) => {
            setItems((current) => [vendor, ...current]);
            setInviteOpen(false);
          }}
        />
      ) : null}
      {offerVendor ? (
        <OfferVendorModal
          vendor={offerVendor}
          requestId={query ?? ""}
          onClose={() => setOfferVendor(null)}
        />
      ) : null}
      {profileVendor ? (
        <VendorProfileModal
          vendor={profileVendor}
          onClose={() => setProfileVendor(null)}
        />
      ) : null}
    </>
  );
}
function InviteVendorModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (vendor: VendorRecord) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    trade: "Plumbing",
    phone: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.inviteVendor(form);
      onCreated(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invitation failed");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Invite a vendor" onClose={onClose}>
      {error ? <ErrorNotice message={error} onRetry={() => undefined} /> : null}
      <form onSubmit={submit} className="form-grid">
        <label>
          Company
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label>
          Email
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
          />
        </label>
        <label>
          Trade
          <select
            value={form.trade}
            onChange={(event) =>
              setForm({ ...form, trade: event.target.value })
            }
          >
            <option>Plumbing</option>
            <option>Heating and cooling</option>
            <option>Electrical</option>
            <option>General maintenance</option>
          </select>
        </label>
        <label>
          Phone
          <input
            value={form.phone}
            onChange={(event) =>
              setForm({ ...form, phone: event.target.value })
            }
          />
        </label>
        <div className="drawer-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Sending…" : "Send invitation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function OfferVendorModal({
  vendor,
  requestId,
  onClose,
}: {
  vendor: VendorRecord;
  requestId: string;
  onClose: () => void;
}) {
  const [note, setNote] = useState(
    "Please confirm the diagnosis-only scope and proposed arrival window.",
  );
  const [window, setWindow] = useState(vendor.availability);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!requestId) {
      setError("Open this screen from a request before offering a job.");
      return;
    }
    setSaving(true);
    try {
      await api.offerVendor(requestId, {
        vendorId: vendor.id,
        note,
        preferredWindow: window,
      });
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Offer could not be sent",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Offer job to ${vendor.name}`} onClose={onClose}>
      {error ? <ErrorNotice message={error} onRetry={() => undefined} /> : null}
      <form onSubmit={submit} className="form-grid">
        <div className="notice">
          <Users size={18} />
          <div>
            <strong>
              {vendor.trade} · {vendor.distance}
            </strong>
            <span>
              {vendor.firstVisitFixes} · {vendor.status}
            </span>
          </div>
        </div>
        <label>
          Proposed visit window
          <select
            value={window}
            onChange={(event) => setWindow(event.target.value)}
          >
            <option>{vendor.availability}</option>
            <option>Today · 2–4 PM</option>
            <option>Tomorrow · 9–11 AM</option>
          </select>
        </label>
        <label>
          Message to vendor
          <textarea
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <div className="drawer-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Sending…" : "Send offer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function VendorProfileModal({
  vendor,
  onClose,
}: {
  vendor: VendorRecord;
  onClose: () => void;
}) {
  return (
    <Modal title={vendor.name} onClose={onClose}>
      <div className="profile-modal">
        <div className="vendor-avatar large">{vendor.name.slice(0, 1)}</div>
        <h3>{vendor.trade} service partner</h3>
        <Pill
          tone={
            vendor.status === "preferred"
              ? "lime"
              : vendor.status === "approved"
                ? "green"
                : "gold"
          }
        >
          {vendor.status}
        </Pill>
        <div className="fact-grid">
          <Fact label="DISTANCE" value={vendor.distance} />
          <Fact label="AVAILABILITY" value={vendor.availability} />
          <Fact label="FIRST VISIT FIXES" value={vendor.firstVisitFixes} />
          <Fact
            label="INSURANCE"
            value={vendor.status === "review" ? "Needs review" : "Verified"}
          />
        </div>
        {vendor.status === "review" ? (
          <div className="notice danger">
            <AlertCircle size={18} />
            <div>
              <strong>Compliance review required</strong>
              <span>
                Request insurance and licence documents before assigning a job.
              </span>
            </div>
          </div>
        ) : (
          <div className="notice success">
            <Check size={18} />
            <div>
              <strong>Eligible for assignment</strong>
              <span>Performance evidence is available for this vendor.</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Properties() {
  const {
    data: items,
    setData: setItems,
    loading,
    error,
    refresh: load,
  } = useApiResource(
    useCallback((signal) => api.properties(signal), []),
    [] as PropertyRecord[],
  );
  const { data: repairs } = useApiResource(
    useCallback((signal) => api.requests(undefined, signal), []),
    [] as RequestRecord[],
  );
  const [addOpen, setAddOpen] = useState(false);
  const primary = items[0];
  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Properties"
        description="Portfolio health without losing the repair context."
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={17} /> Add property
          </Button>
        }
      />
      {error ? <ErrorNotice message={error} onRetry={load} /> : null}
      {loading ? (
        <LoadingState label="Loading properties…" />
      ) : primary ? (
        <>
          <div className="property-grid">
            <Link
              to={`/properties/${primary.id}`}
              className="surface property-hero"
            >
              <img
                src={
                  primary.imageUrl ??
                  "/repairledger-redesign/assets/oak-street-property.png"
                }
                alt={`${primary.name} rental property`}
              />
              <div className="property-hero-copy">
                <div>
                  <span className="label">{primary.name.toUpperCase()}</span>
                  <h2>{primary.name}</h2>
                  <span className="muted">
                    {primary.units} units · {primary.timezone}
                  </span>
                </div>
                <Pill tone="urgent">{primary.urgentRequests} urgent</Pill>
              </div>
            </Link>
            <section className="surface property-actions">
              <div className="section-title">
                <h3>Your action queue</h3>
                <Pill tone="lime">Updated now</Pill>
              </div>
              {repairs
                .filter(
                  (request) =>
                    request.propertyId === primary.id &&
                    !["closed", "cancelled"].includes(request.state),
                )
                .slice(0, 3)
                .map((request) => (
                  <ActionRow key={request.id} request={request} />
                ))}
            </section>
          </div>
          <section className="stat-grid property-stats">
            <StatCard
              label="OPEN REQUESTS"
              value={String(primary.openRequests)}
              detail={`${primary.urgentRequests} urgent`}
            />
            <StatCard
              label="UNITS"
              value={String(primary.units)}
              detail="Across this property"
            />
            <StatCard
              label="KNOWN ASSETS"
              value={String(primary.assets)}
              detail="Recorded assets"
            />
            <StatCard
              label="UPCOMING SERVICE"
              value={String(
                repairs.filter(
                  (item) =>
                    item.propertyId === primary.id &&
                    item.appointment?.status === "confirmed" &&
                    item.state === "scheduled",
                ).length,
              )}
              detail="Confirmed visits"
            />
          </section>
          <section className="property-list">
            {items.slice(1).map((property) => (
              <Link
                className="surface property-list-row"
                to={`/properties/${property.id}`}
                key={property.id}
              >
                <div>
                  <strong>{property.name}</strong>
                  <span>{property.address}</span>
                </div>
                <div>
                  <Pill tone="green">{property.openRequests} open</Pill>
                  <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          </section>
        </>
      ) : (
        <EmptyState
          title="No properties yet"
          detail="Add the first property to start tracking units and repairs."
          action={
            <Button onClick={() => setAddOpen(true)}>Add property</Button>
          }
        />
      )}{" "}
      {addOpen ? (
        <AddPropertyModal
          onClose={() => setAddOpen(false)}
          onCreated={(property) => {
            setItems((current) => [property, ...current]);
            setAddOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
function AddPropertyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (property: PropertyRecord) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    address: "",
    units: "1",
    timezone: "America/New_York",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.createProperty({
        ...form,
        units: Number(form.units),
      });
      onCreated(data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Property could not be created",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Add property" onClose={onClose}>
      {error ? <ErrorNotice message={error} onRetry={() => undefined} /> : null}
      <form className="form-grid" onSubmit={submit}>
        <label>
          Property name
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label>
          Address
          <input
            required
            value={form.address}
            onChange={(event) =>
              setForm({ ...form, address: event.target.value })
            }
          />
        </label>
        <label>
          Units
          <input
            required
            min="1"
            type="number"
            value={form.units}
            onChange={(event) =>
              setForm({ ...form, units: event.target.value })
            }
          />
        </label>
        <label>
          Timezone
          <select
            value={form.timezone}
            onChange={(event) =>
              setForm({ ...form, timezone: event.target.value })
            }
          >
            <option>America/New_York</option>
            <option>Asia/Kolkata</option>
            <option>Europe/London</option>
          </select>
        </label>
        <div className="drawer-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Create property"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function EditPropertyModal({
  property,
  onClose,
  onSaved,
}: {
  property: PropertyRecord;
  onClose: () => void;
  onSaved: (property: PropertyRecord) => void;
}) {
  const [form, setForm] = useState({
    name: property.name,
    address: property.address,
    units: String(property.units),
    timezone: property.timezone,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { data } = await api.updateProperty(property.id, {
        ...form,
        units: Number(form.units),
      });
      onSaved(data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Property could not be updated",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Edit ${property.name}`} onClose={onClose}>
      {error ? <ErrorNotice message={error} onRetry={() => undefined} /> : null}
      <form className="form-grid" onSubmit={submit}>
        <label>
          Property name
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label>
          Address
          <input
            required
            value={form.address}
            onChange={(event) =>
              setForm({ ...form, address: event.target.value })
            }
          />
        </label>
        <label>
          Units
          <input
            required
            min="1"
            type="number"
            value={form.units}
            onChange={(event) =>
              setForm({ ...form, units: event.target.value })
            }
          />
        </label>
        <label>
          Timezone
          <select
            value={form.timezone}
            onChange={(event) =>
              setForm({ ...form, timezone: event.target.value })
            }
          >
            <option>America/New_York</option>
            <option>Asia/Kolkata</option>
            <option>Europe/London</option>
          </select>
        </label>
        <div className="drawer-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save property"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function PropertyDetail() {
  const { id = "" } = useParams();
  const {
    data: properties,
    setData: setProperties,
    loading: propertiesLoading,
    error: propertyError,
    refresh: refreshProperties,
  } = useApiResource(
    useCallback((signal) => api.properties(signal), []),
    [] as PropertyRecord[],
  );
  const {
    data: requests,
    loading: requestsLoading,
    error: requestError,
    refresh: refreshRequests,
  } = useApiResource(
    useCallback((signal) => api.requests({ property: id }, signal), [id]),
    [] as RequestRecord[],
  );
  const [editOpen, setEditOpen] = useState(false);
  const error = propertyError || requestError;
  const refresh = () => {
    refreshProperties();
    refreshRequests();
  };
  if (propertiesLoading || requestsLoading)
    return <LoadingState label="Loading property…" />;
  const property = properties.find((item) => item.id === id);
  if (!property)
    return error ? (
      <ErrorNotice message={error} onRetry={refresh} />
    ) : (
      <EmptyState
        title="Property not found"
        detail="Return to your portfolio to select an active property."
      />
    );
  return (
    <>
      <div className="crumb">
        <Link to="/properties">
          <ArrowLeft size={15} /> Properties
        </Link>
        <span>/</span>
        <span>{property.name}</span>
      </div>
      <PageHeader
        eyebrow="Property profile"
        title={property.name}
        description={`${property.address} · ${property.timezone}`}
        action={
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Edit property
          </Button>
        }
      />
      {error ? <ErrorNotice message={error} onRetry={refresh} /> : null}
      <div className="property-detail-grid">
        <section className="surface detail-panel">
          <div className="section-title">
            <div>
              <span className="label">OVERVIEW</span>
              <h3>Portfolio health</h3>
            </div>
            <Pill tone="lime">{property.units} units</Pill>
          </div>
          <div className="stat-grid">
            <StatCard
              label="OPEN REQUESTS"
              value={String(property.openRequests)}
              detail="Across all units"
            />
            <StatCard
              label="URGENT"
              value={String(property.urgentRequests)}
              detail="Need action"
              tone="urgent"
            />
            <StatCard
              label="ASSETS"
              value={String(property.assets)}
              detail="Known assets"
            />
          </div>
        </section>
        <section className="surface detail-panel">
          <div className="section-title">
            <div>
              <span className="label">REQUESTS</span>
              <h3>Recent maintenance</h3>
            </div>
            <Link className="text-button" to="/requests">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {requests.length ? (
            requests
              .slice(0, 5)
              .map((request) => (
                <ActionRow key={request.id} request={request} />
              ))
          ) : (
            <EmptyState
              title="No recent requests"
              detail="New maintenance requests will appear here."
            />
          )}
        </section>
      </div>
      <CommonAreaSection propertyId={id} />
      {editOpen ? (
        <EditPropertyModal
          property={property}
          onClose={() => setEditOpen(false)}
          onSaved={(next) => {
            setProperties((current) =>
              current.map((item) => (item.id === next.id ? next : item)),
            );
            setEditOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function Costs() {
  const {
    data: requests,
    loading,
    error,
    refresh,
  } = useApiResource(
    useCallback((signal) => api.requests(undefined, signal), []),
    [] as RequestRecord[],
  );
  const rows = requests.flatMap((request) =>
    (request.estimates?.length
      ? request.estimates
      : request.estimate
        ? [request.estimate]
        : []
    ).map((estimate) => ({ request, estimate })),
  );
  const totals = approvedQuoteTotals(requests);
  const pending = requests.filter(
    (request) => managerAction(request) === "review_quote",
  ).length;
  const approved = requests.filter(
    (request) =>
      request.state !== "cancelled" && request.estimate?.status === "approved",
  ).length;
  return (
    <>
      <PageHeader
        eyebrow="Quote control"
        title="Clear scope. Controlled costs."
        description="Review current authorizations without mixing currencies or counting a quote as a paid invoice."
        action={
          <Button
            variant="secondary"
            disabled={loading || Boolean(error) || !rows.length}
            onClick={() =>
              downloadCsv(
                rows.map(({ request, estimate }) => ({
                  request: request.id,
                  title: request.title,
                  vendor: request.assignedVendorName ?? "Not assigned",
                  version: estimate.version,
                  currency: quoteCurrency(estimate.currency),
                  scope: estimate.scope,
                  amount: estimate.total,
                  status: estimate.status,
                })),
                "repairledger-quotes.csv",
              )
            }
          >
            <Download size={16} />
            Export quote history
          </Button>
        }
      />
      {error ? (
        <ErrorNotice message={error} onRetry={refresh} />
      ) : loading ? (
        <LoadingState label="Loading quote history…" />
      ) : (
        <>
          <section className="cost-highlight">
            <div>
              <span className="label lime-text">
                CURRENT APPROVED QUOTE VALUE
              </span>
              <div className="currency-totals">
                {totals.length ? (
                  totals.map((total) => (
                    <div key={total.currency}>
                      <h2>{money(total.amount, total.currency)}</h2>
                      <span>{total.currency}</span>
                    </div>
                  ))
                ) : (
                  <h2>—</h2>
                )}
              </div>
              <p>
                {totals.length
                  ? "Latest approved quote per repair. Cancelled repairs excluded. Currencies are never combined."
                  : "No current approved quotes recorded."}{" "}
                Invoices and payments are not tracked.
              </p>
            </div>
            <div className="cost-rings">
              <div>
                <strong>{pending}</strong>
                <span>quotes need your review</span>
              </div>
              <div>
                <strong>{approved}</strong>
                <span>current authorizations</span>
              </div>
            </div>
          </section>
          {pending ? (
            <Link
              className="quote-review-banner"
              to="/requests?filter=awaiting"
            >
              <CircleDollarSign size={18} />
              <span>
                <strong>
                  {pending} vendor {pending === 1 ? "quote is" : "quotes are"}{" "}
                  waiting for your decision.
                </strong>
                <small>
                  Review the scope before approving or returning it with a note.
                </small>
              </span>
              <ArrowRight size={18} />
            </Link>
          ) : null}
          <section className="surface table-surface quote-history">
            <div className="section-title">
              <div>
                <span className="label">QUOTE HISTORY</span>
                <h2>Every version, kept on record.</h2>
              </div>
              <Pill tone="neutral">{rows.length} recorded versions</Pill>
            </div>
            {rows.length ? (
              <div className="table-wrap">
                <table>
                  <caption className="visually-hidden">
                    Vendor quote history with separate currencies
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">REPAIR</th>
                      <th scope="col">VENDOR</th>
                      <th scope="col">VERSION</th>
                      <th scope="col">QUOTE / CURRENCY</th>
                      <th scope="col">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ request, estimate }) => (
                      <tr key={estimate.id}>
                        <td>
                          <Link
                            to={`/requests/${encodeURIComponent(request.id)}?tab=costs`}
                            className="table-primary"
                          >
                            {request.id}
                            <span>{request.title}</span>
                          </Link>
                        </td>
                        <td>{request.assignedVendorName ?? "Not assigned"}</td>
                        <td>v{estimate.version}</td>
                        <td>
                          {money(estimate.total, estimate.currency)}
                          <span className="quote-currency">
                            {quoteCurrency(estimate.currency)}
                          </span>
                        </td>
                        <td>
                          <Pill
                            tone={
                              estimate.status === "approved"
                                ? "green"
                                : estimate.status === "changes_requested"
                                  ? "urgent"
                                  : "gold"
                            }
                          >
                            {formatState(estimate.status)}
                          </Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No quote history yet"
                detail="An accepted vendor can submit an itemized quote. Approval is recorded before work begins."
                action={
                  <Link className="button secondary" to="/requests">
                    Review requests
                    <ArrowRight size={14} />
                  </Link>
                }
              />
            )}
          </section>
        </>
      )}
    </>
  );
}

function LanguageSettings() {
  const account = useContext(RoleContext);
  const { language, setLanguage } = useContext(LanguageContext);
  const [params, setParams] = useSearchParams();
  const context = params.has("profile")
    ? "profile"
    : params.has("workspace")
      ? "workspace"
      : params.has("help")
        ? "help"
        : "";
  const [saved, setSaved] = useState(false);
  const save = () => {
    localStorage.setItem(
      "repairledger-language-settings",
      JSON.stringify({ language }),
    );
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  return (
    <>
      <PageHeader
        eyebrow="Workspace settings"
        title="Language & workspace access"
        description="Set a browser language preference and understand current coverage."
        action={
          <Button onClick={save}>
            {saved ? <Check size={16} /> : null}
            {saved ? "Saved" : "Save changes"}
          </Button>
        }
      />
      <div className="settings-grid">
        <section className="surface settings-card">
          <span className="label">THIS BROWSER</span>
          <h2>Interface language</h2>
          <p className="muted">
            Changes navigation labels for this browser. This is not a shared
            workspace setting.
          </p>
          <label className="field-label">
            Interface language
            <select
              value={language}
              onChange={(event) => {
                setLanguage(event.target.value as LanguageCode);
                setSaved(false);
              }}
            >
              {(Object.keys(languageNames) as LanguageCode[]).map((code) => (
                <option key={code} value={code}>
                  {languageNames[code]}
                </option>
              ))}
            </select>
          </label>
          <div className="language-row">
            <Languages size={17} />
            <div>
              <strong>Resident language choices</strong>
              <span>
                English · हिन्दी · Español · Français · Deutsch · العربية
              </span>
            </div>
            <Pill tone="gold">Navigation packs</Pill>
          </div>
        </section>
        <section className="surface settings-card">
          <span className="label">COVERAGE, NOT CLAIMS</span>
          <h2>Original messages stay original.</h2>
          <p className="muted">
            English is the complete workflow language today. Hindi, Spanish,
            French, German and Arabic cover navigation, with English fallback
            for forms and actions. Arabic also switches the layout direction.
          </p>
          <div className="translation-boundary">
            <AlertCircle size={18} />
            <div>
              <strong>Automatic translation is not connected</strong>Messages
              and safety details are not automatically translated. Keep the
              original text and ask the sender to clarify anything ambiguous.
            </div>
          </div>
          <div className="coverage-list">
            <span>Navigation: 6 languages</span>
            <span>Workflow copy: English</span>
            <span>Machine translation: not enabled</span>
          </div>
        </section>
      </div>
      {context ? (
        <Modal
          title={
            context === "profile"
              ? "Your profile"
              : context === "workspace"
                ? "Workspace switcher"
                : "Operator guide"
          }
          onClose={() => setParams({})}
        >
          <div className="profile-modal">
            {context === "profile" ? (
              <>
                <div className="avatar">
                  {account.displayName.slice(0, 1).toUpperCase()}
                </div>
                <h3>{account.displayName}</h3>
                <p className="muted">
                  {formatState(account.role)} · {account.workspaceName}
                </p>
                <div className="notice success">
                  <Check size={18} />
                  <div>
                    <strong>Account ready</strong>
                    <span>
                      Profile and role controls are managed through your
                      workspace identity provider.
                    </span>
                  </div>
                </div>
              </>
            ) : context === "workspace" ? (
              <>
                <div className="avatar">
                  {account.workspaceName.slice(0, 1).toUpperCase()}
                </div>
                <h3>{account.workspaceName}</h3>
                <p className="muted">{formatState(account.role)} workspace</p>
                <div className="notice">
                  <Home size={18} />
                  <div>
                    <strong>Current workspace</strong>
                    <span>
                      Workspace membership is managed through your identity
                      provider.
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="success-mark">
                  <LifeBuoy size={22} />
                </div>
                <h3>Operator guide</h3>
                <p className="muted">
                  Use the action queue for urgent work, keep resident messages
                  on the request, and approve estimates only after the scope is
                  clear.
                </p>
              </>
            )}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function PublicShell({
  children,
  step,
  total = 5,
}: {
  children: ReactNode;
  step?: number;
  total?: number;
}) {
  return (
    <div className="public-shell">
      <div className="public-brand">
        <Link to="/" className="brand-row">
          <span className="brand-mark">R</span>
          <span className="brand-name">RepairLedger</span>
        </Link>
      </div>
      <div className="public-help">
        <span>Resident portal</span>
        <LanguageMenu compact />
      </div>
      {step ? (
        <div className="progress-strip">
          {Array.from({ length: total }).map((_, index) => (
            <span key={index} className={index < step ? "done" : ""} />
          ))}
        </div>
      ) : null}
      <div className="public-layout">
        <div
          className="public-image"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(22,58,50,.08), rgba(22,58,50,.96)), url(/repairledger-redesign/assets/kitchen-leak-evidence.png)",
          }}
        >
          <div>
            <span className="label lime-text">YOUR REPAIR WORKSPACE</span>
            <h2>A clear path from problem to fixed.</h2>
            <p>
              Your report, visit and updates stay together. No app download
              required.
            </p>
          </div>
        </div>
        <main className="public-main">
          <nav className="resident-nav" aria-label="Resident portal">
            <NavLink to="/tenant" end>
              My repairs
            </NavLink>
            <NavLink to="/tenant/report">Report an issue</NavLink>
          </nav>
          {children}
        </main>
      </div>
    </div>
  );
}
function PublicHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="public-header">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function TenantHome() {
  const {
    data: items,
    loading,
    error,
    refresh,
    lastLoadedAt,
  } = useApiResource(
    useCallback((signal) => api.requests({}, signal), []),
    [] as RequestRecord[],
  );
  const [view, setView] = useState<"open" | "action" | "history">("open");
  const open = items.filter(isOpen);
  const action = open.filter((item) => residentAction(item) !== null);
  const history = items.filter((item) => !isOpen(item));
  const records = sortRequests(
    view === "open" ? open : view === "action" ? action : history,
    "newest",
  ).sort(
    (a, b) =>
      Number(Boolean(residentAction(b))) - Number(Boolean(residentAction(a))),
  );
  return (
    <PublicShell>
      <PublicHeader
        eyebrow="YOUR HOME · YOUR REPAIRS"
        title="My repairs"
        description="Track progress, agree a visit and tell us whether the repair is fixed. Your messages stay with each repair."
      />
      <div className="resident-home-actions">
        <Link to="/tenant/report" className="button primary">
          <Plus size={16} /> Report an issue
        </Link>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>
      {loading ? (
        <LoadingState label="Loading your repairs…" />
      ) : error ? (
        <ErrorNotice message={error} onRetry={refresh} />
      ) : (
        <>
          <div className="resident-filters" aria-label="Repair lists">
            {(
              [
                ["open", "Open repairs", open.length],
                ["action", "Needs your response", action.length],
                ["history", "History", history.length],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>
          {action.length > 0 && view !== "history" ? (
            <div className="resident-response-note">
              <MessageCircle size={18} />
              <p>
                <strong>
                  {action.length}{" "}
                  {action.length === 1 ? "repair needs" : "repairs need"} your
                  response.
                </strong>{" "}
                Open the repair to confirm a proposed visit or share the
                outcome.
              </p>
            </div>
          ) : null}
          {records.length ? (
            <div className="resident-repair-list">
              {records.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  to={`/tenant/status/${encodeURIComponent(request.id)}`}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                view === "action"
                  ? "You're all caught up"
                  : view === "history"
                    ? "No repair history yet"
                    : "No open repairs"
              }
              detail={
                view === "action"
                  ? "There are no visit confirmations or repair outcomes waiting for you."
                  : "When you report an issue, its progress and messages will appear here."
              }
            />
          )}
          {lastLoadedAt ? (
            <p className="data-freshness">
              Last refreshed{" "}
              {lastLoadedAt.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
              . Use Refresh for the latest updates.
            </p>
          ) : null}
        </>
      )}
    </PublicShell>
  );
}

function TenantReport() {
  const { language } = useContext(LanguageContext);
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [unit, setUnit] = useState("");
  const [resident, setResident] = useState("");
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("Plumbing");
  const [description, setDescription] = useState("");
  const [permission, setPermission] = useState("Resident must be home");
  const [availability, setAvailability] = useState("Flexible");
  const [notes, setNotes] = useState("");
  const [flowing, setFlowing] = useState("No");
  const [nearElectricity, setNearElectricity] = useState("No");
  const [sparks, setSparks] = useState("No");
  const [file, setFile] = useState<File | null>(null);
  const photoUrl = useObjectUrl(file);
  const [uploadStatus, setUploadStatus] = useState(
    "Optional · not uploaded yet",
  );
  const [submittedId, setSubmittedId] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const property = properties.find((item) => item.id === propertyId);
  const urgent =
    category === "Plumbing"
      ? flowing === "Yes" || nearElectricity === "Yes"
      : category === "Electrical"
        ? sparks === "Yes"
        : false;

  useEffect(() => {
    let active = true;
    let savedPropertyId = "";
    const draft = localStorage.getItem("repairledger-report-draft");
    if (draft) {
      try {
        const saved = JSON.parse(draft);
        savedPropertyId =
          typeof saved.propertyId === "string" ? saved.propertyId : "";
        setCategory(saved.category ?? "Plumbing");
        setDescription(saved.description ?? "");
        setUnit(saved.unit ?? "");
        setResident(saved.resident ?? "");
        setPermission(saved.permission ?? "Resident must be home");
        setAvailability(saved.availability ?? "Flexible");
        setNotes(saved.notes ?? "");
        setFlowing(saved.flowing ?? "No");
        setNearElectricity(saved.nearElectricity ?? "No");
        setSparks(saved.sparks ?? "No");
        setStep(Math.max(1, Math.min(4, saved.step ?? 1)));
      } catch {
        localStorage.removeItem("repairledger-report-draft");
      }
    }
    api
      .properties()
      .then(({ data }) => {
        if (active) {
          setProperties(data);
          if (data.length)
            setPropertyId(
              data.some((item) => item.id === savedPropertyId)
                ? savedPropertyId
                : data[0].id,
            );
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Your property list could not be loaded.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    if (supabase)
      supabase.auth.getUser().then(({ data }) => {
        const displayName = data.user?.user_metadata?.name;
        if (typeof displayName === "string") setResident(displayName);
      });
    return () => {
      active = false;
    };
  }, []);

  const saveDraft = () => {
    localStorage.setItem(
      "repairledger-report-draft",
      JSON.stringify({
        propertyId,
        category,
        description,
        unit,
        resident,
        permission,
        availability,
        notes,
        flowing,
        nearElectricity,
        sparks,
        step,
      }),
    );
    setUploadStatus("Draft saved on this device.");
  };
  const selectFile = (next?: File) => {
    if (!next) return;
    try {
      validateEvidence(next);
    } catch (reason) {
      setUploadStatus(
        reason instanceof Error ? reason.message : "Invalid file.",
      );
      return;
    }
    setFile(next);
    setUploadStatus("Selected. It will upload after you submit the repair.");
  };
  const submit = async () => {
    if (!property || !unit.trim() || !resident.trim() || !description.trim()) {
      setError(
        "Choose your property and unit, enter your name, and describe the issue.",
      );
      return;
    }
    setSaving(true);
    setError("");
    setUploadError("");
    try {
      const safetyAnswers: Record<string, string> =
        category === "Plumbing"
          ? { waterFlowing: flowing, waterNearElectricity: nearElectricity }
          : category === "Electrical"
            ? { sparksOrSmoke: sparks }
            : {};
      const { data } = await api.createRequest({
        category,
        title:
          description.trim().split(/[.!?]/)[0].slice(0, 80) ||
          `${category} repair`,
        property: property.name,
        propertyId: property.id,
        timezone: property.timezone,
        unit: unit.trim(),
        resident: resident.trim(),
        description: description.trim(),
        priority: urgent ? "urgent" : "routine",
        language,
        access: permission,
        accessNotes: notes.trim(),
        preferredWindow: availability,
        safetyAnswers,
      });
      if (file && !demoMode) {
        try {
          await api.uploadEvidence(file, data.id);
          setUploadStatus("Evidence uploaded and attached to the repair.");
        } catch (reason) {
          setUploadError(
            reason instanceof Error
              ? reason.message
              : "The repair was saved, but the attachment did not upload.",
          );
        }
      } else if (file)
        setUploadStatus(
          "Sample mode: file preview only; it is not saved to storage.",
        );
      localStorage.removeItem("repairledger-report-draft");
      setSubmittedId(data.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not save the request. Your draft remains on this device.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <PublicShell>
        <LoadingState label="Loading your property details…" />
      </PublicShell>
    );
  if (submittedId)
    return (
      <PublicShell>
        <div className="success-page">
          <div className="success-mark">
            <Check size={26} />
          </div>
          <PublicHeader
            eyebrow={`Repair reference · ${submittedId}`}
            title="Your report is recorded"
            description={`${property?.name ?? "Your property"} · Unit ${unit}. Keep this reference to check progress.`}
          />
          {uploadError ? (
            <div className="notice danger">
              <AlertCircle size={18} />
              <span>{uploadError}</span>
            </div>
          ) : null}
          <div className="next-card">
            <strong>Next: landlord review</strong>
            <span>
              The manager can see this repair in their workspace. This app does
              not send email or SMS updates yet.
            </span>
          </div>
          <Link to={`/tenant/status/${submittedId}`} className="button primary">
            Track repair <ArrowRight size={16} />
          </Link>
        </div>
      </PublicShell>
    );

  const next = () => {
    setError("");
    setStep((current) => Math.min(current + 1, 4));
  };
  const contents: Record<number, ReactNode> = {
    1: (
      <>
        <PublicHeader
          eyebrow="Step 1 of 4 · Location"
          title="Where is the problem?"
          description="Choose the unit so the repair reaches the right person."
        />
        <div className="field">
          <label htmlFor="report-property">Property</label>
          <select
            id="report-property"
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
          >
            {properties.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name} · {item.address}
              </option>
            ))}
          </select>
        </div>
        <div className="form-grid two">
          <label>
            Unit
            <input
              required
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="e.g. 3B"
            />
          </label>
          <label>
            Your name
            <input
              required
              value={resident}
              onChange={(event) => setResident(event.target.value)}
              placeholder="Name"
            />
          </label>
        </div>
        <OptionList
          options={[
            ["Plumbing", "Leaks, taps and toilets"],
            ["Heating or cooling", "Temperature and equipment"],
            ["Electrical", "Lights and power"],
            ["Appliances", "Equipment and fixtures"],
            ["Other", "Something else"],
          ]}
          selected={category}
          onSelect={setCategory}
        />
        <div className="public-actions">
          <Button variant="secondary" onClick={saveDraft}>
            Save draft
          </Button>
          <Button
            onClick={next}
            disabled={!property || !unit.trim() || !resident.trim()}
          >
            Describe issue <ArrowRight size={16} />
          </Button>
        </div>
      </>
    ),
    2: (
      <>
        <PublicHeader
          eyebrow="Step 2 of 4 · Details"
          title="Describe what is happening"
          description="A clear description helps the manager choose the right next step."
        />
        <div className="field">
          <label htmlFor="report-description">What needs repair?</label>
          <textarea
            id="report-description"
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            placeholder="What happened, when did it start, and where can it be seen?"
          />
        </div>
        <div className="field">
          <label>Add a photo, video, or document (optional)</label>
          <div className="upload-box">
            {photoUrl && file?.type.startsWith("image/") ? (
              <img src={photoUrl} alt="Selected repair evidence preview" />
            ) : photoUrl && file?.type.startsWith("video/") ? (
              <video
                src={photoUrl}
                controls
                aria-label="Selected video preview"
              />
            ) : photoUrl ? (
              <span>{file?.name} · PDF selected</span>
            ) : (
              <div className="upload-placeholder">
                <Paperclip size={24} />
                <span>No file selected</span>
              </div>
            )}
            <div>
              <strong>{file?.name ?? "No attachment"}</strong>
              <span>{uploadStatus}</span>
            </div>
            <label
              className="icon-button upload-trigger"
              aria-label="Choose evidence"
            >
              <Plus size={20} />
              <input
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,application/pdf"
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
            </label>
          </div>
        </div>
        <div className="public-actions">
          <Button variant="secondary" onClick={() => setStep(1)}>
            Back
          </Button>
          <Button onClick={next} disabled={!description.trim()}>
            Check safety <ArrowRight size={16} />
          </Button>
        </div>
      </>
    ),
    3: (
      <>
        <PublicHeader
          eyebrow="Step 3 of 4 · Safety"
          title="Is anything unsafe right now?"
          description="These answers help flag immediate hazards. Call local emergency services for immediate danger."
        />
        {category === "Plumbing" ? (
          <>
            <Question
              label="Is water still flowing?"
              value={flowing}
              options={["Yes", "No"]}
              onChange={setFlowing}
            />
            <Question
              label="Is water near electrical equipment?"
              value={nearElectricity}
              options={["Yes", "No"]}
              onChange={setNearElectricity}
            />
          </>
        ) : category === "Electrical" ? (
          <Question
            label="Do you see sparks, smoke, or exposed live wires?"
            value={sparks}
            options={["Yes", "No"]}
            onChange={setSparks}
          />
        ) : (
          <div className="notice">
            <Check size={18} />
            <div>
              <strong>No category-specific safety questions</strong>
              <span>
                If you notice an immediate hazard, move away and contact local
                emergency services.
              </span>
            </div>
          </div>
        )}
        {urgent ? (
          <div className="notice danger">
            <AlertCircle size={18} />
            <div>
              <strong>Marked urgent for landlord review</strong>
              <span>
                This report does not contact emergency services or provide
                emergency monitoring.
              </span>
            </div>
          </div>
        ) : null}
        <div className="public-actions">
          <Button variant="secondary" onClick={() => setStep(2)}>
            Back
          </Button>
          <Button onClick={next}>
            Access & availability <ArrowRight size={16} />
          </Button>
        </div>
      </>
    ),
    4: (
      <>
        <PublicHeader
          eyebrow="Step 4 of 4 · Review"
          title="How can the repair team visit?"
          description="These are preferences only. A visit is not confirmed until both sides accept a time."
        />
        <div className="field">
          <label htmlFor="permission">Permission to enter</label>
          <select
            id="permission"
            value={permission}
            onChange={(event) => setPermission(event.target.value)}
          >
            <option>Resident must be home</option>
            <option>Anytime with notice</option>
            <option>Use the lockbox</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="availability">Preferred availability</label>
          <select
            id="availability"
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
          >
            <option>Flexible</option>
            <option>Weekday mornings</option>
            <option>Weekday afternoons</option>
            <option>Weekday evenings</option>
            <option>Weekend availability</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="report-notes">Access notes (optional)</label>
          <input
            id="report-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Pets, call on arrival, or access instructions"
          />
        </div>
        {error ? (
          <div className="notice danger">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}
        <div className="review-grid">
          <Fact
            label="PROPERTY"
            value={`${property?.name ?? "—"} · Unit ${unit || "—"}`}
          />
          <Fact
            label="ISSUE"
            value={`${category} · ${description.slice(0, 45)}${description.length > 45 ? "…" : ""}`}
          />
          <Fact
            label="SAFETY"
            value={
              urgent ? "Urgent · landlord review" : "No urgent answer selected"
            }
          />
          <Fact label="EVIDENCE" value={file?.name ?? "None"} />
          <Fact label="AVAILABILITY" value={availability} />
        </div>
        <div className="public-actions">
          <Button variant="secondary" onClick={() => setStep(3)}>
            Back
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving repair…" : "Submit repair"}{" "}
            <ArrowRight size={16} />
          </Button>
        </div>
      </>
    ),
  };
  return (
    <PublicShell step={step} total={4}>
      {contents[step]}
    </PublicShell>
  );
}

function OptionList({
  options,
  selected,
  onSelect,
}: {
  options: string[][];
  selected?: string;
  onSelect?: (value: string) => void;
}) {
  return (
    <div className="option-list">
      {options.map(([label, detail]) => (
        <button
          type="button"
          key={label}
          onClick={() => onSelect?.(label)}
          className={selected === label ? "selected" : ""}
        >
          <span className="radio-dot">
            {selected === label ? <Check size={13} /> : null}
          </span>
          <span>
            <strong>{label}</strong>
            <small>{detail}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
function Question({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="question">
      <strong>{label}</strong>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={value === option ? "selected" : ""}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function TenantRepairStatus() {
  const { role } = useContext(RoleContext);
  const canRespond = role === "tenant" || role === "demo";
  const { id = "" } = useParams();
  const {
    data: detail,
    setData: setDetail,
    loading,
    error,
    setError,
    refresh: load,
  } = useApiResource(
    useCallback((signal) => api.request(id, signal), [id]),
    null as RequestDetail | null,
  );
  const [saving, setSaving] = useState(false);
  const [verificationNote, setVerificationNote] = useState("");
  const respondToAppointment = async (confirmed: boolean) => {
    if (!detail?.appointment) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.confirmAppointment(
        id,
        detail.appointment.id,
        confirmed,
        "resident",
      );
      setDetail(data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your appointment response could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  const verify = async (fixed: boolean) => {
    setSaving(true);
    setError("");
    try {
      const { data } = await api.verifyRepair(
        id,
        fixed,
        verificationNote.trim() || undefined,
      );
      setDetail(data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your repair response could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (loading)
    return (
      <PublicShell>
        <LoadingState label="Loading repair status…" />
      </PublicShell>
    );
  if (error && !detail)
    return (
      <PublicShell>
        <ErrorNotice message={error} onRetry={load} />
      </PublicShell>
    );
  if (!detail) return null;
  const appointment = detail.appointment;
  return (
    <PublicShell>
      <div className="status-page">
        {detail.state === "closed" &&
        detail.residentVerification?.status === "verified" ? (
          <Pill tone="lime">Resident confirmed fixed</Pill>
        ) : (
          <RequestStatus request={detail} />
        )}
        <PublicHeader
          eyebrow={`${detail.id} · REPAIR STATUS`}
          title={
            detail.state === "closed"
              ? detail.residentVerification?.status === "verified"
                ? "Thanks for confirming."
                : "Your repair record is closed."
              : detail.state === "verification"
                ? "Is the repair fixed?"
                : "Here is the latest on your repair."
          }
          description={`${detail.property} · Unit ${detail.unit} · ${detail.title}`}
        />
        <RepairProgress request={detail} />
        <section className="status-card">
          <div className="status-summary">
            <Fact
              label="NEXT RESPONSIBLE PERSON"
              value={nextStep(detail).owner}
            />
            <Fact label="NEXT STEP" value={nextStep(detail).title} />
            <Fact
              label="REQUESTED AVAILABILITY"
              value={detail.preferredWindow ?? "Not provided"}
            />
          </div>
          {appointment ? <VisitConfirmation appointment={appointment} /> : null}
          {error ? (
            <div className="notice danger">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          ) : null}
          {canRespond &&
          appointment?.status === "proposed" &&
          !appointment.residentConfirmedAt ? (
            <div className="button-row">
              <Button
                onClick={() => void respondToAppointment(true)}
                disabled={saving}
              >
                Confirm this time
              </Button>
              <Button
                variant="secondary"
                onClick={() => void respondToAppointment(false)}
                disabled={saving}
              >
                I cannot attend
              </Button>
            </div>
          ) : null}
          {canRespond && detail.state === "verification" ? (
            <div className="verification-card">
              <h3>Did the repair fix the problem?</h3>
              <p>
                Your answer updates the repair record. If it is still happening,
                the manager will see that follow-up work is needed.
              </p>
              <label className="verification-note">
                Anything we should know? (optional)
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={verificationNote}
                  onChange={(event) => setVerificationNote(event.target.value)}
                  placeholder="If it is not fixed, explain what is still happening."
                />
              </label>
              <div className="button-row">
                <Button onClick={() => void verify(true)} disabled={saving}>
                  Yes, it is fixed
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void verify(false)}
                  disabled={saving}
                >
                  No, it is still happening
                </Button>
              </div>
            </div>
          ) : null}
          <Timeline events={detail.events ?? []} />
        </section>
        <div className="button-row">
          <Link
            to={`/tenant/status/${detail.id}/messages`}
            className="button primary"
          >
            <MessageCircle size={16} /> Message manager
          </Link>
          <Link to="/tenant/report" className="button secondary">
            Report another issue
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}

function TenantMessages() {
  const { id = "" } = useParams();
  const {
    data: messages,
    setData: setMessages,
    loading,
    error,
    setError,
    refresh: load,
  } = useApiResource(
    useCallback((signal) => api.messages(id, signal), [id]),
    [] as MessageRecord[],
  );
  const [body, setBody] = useState("");
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    try {
      const { data } = await api.sendMessage(id, body.trim());
      setMessages((current) => [...current, data]);
      setBody("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Message could not be sent",
      );
    }
  };
  return (
    <PublicShell>
      <div className="status-page">
        <div className="crumb">
          <Link to={`/tenant/status/${id}`}>
            <ArrowLeft size={15} /> Repair status
          </Link>
        </div>
        <PublicHeader
          eyebrow={`${id} · CONVERSATION`}
          title="Message your manager"
          description="Keep access details and updates in the same repair record."
        />
        {error ? (
          <div className="notice danger">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button className="button secondary" onClick={load}>
              Retry
            </button>
          </div>
        ) : null}
        {loading ? (
          <LoadingState label="Loading conversation…" />
        ) : messages.length ? (
          <div className="message-thread public-thread">
            {messages.map((message) => (
              <div
                className={`message-bubble ${message.role === "resident" ? "outgoing" : ""}`}
                key={message.id}
              >
                <div>
                  <strong>{message.sender}</strong>
                  <time>{message.at}</time>
                </div>
                <p>{message.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No messages yet"
            detail="Ask a question and the manager will see it here."
          />
        )}
        <form className="composer" onSubmit={send}>
          <textarea
            aria-label="Message your manager"
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add a detail or question…"
          />
          <Button type="submit" disabled={!body.trim()}>
            Send message <Send size={15} />
          </Button>
        </form>
      </div>
    </PublicShell>
  );
}

function VendorQueue() {
  const {
    data: jobs,
    setData: setJobs,
    loading,
    error,
    setError,
    refresh: load,
  } = useApiResource(
    useCallback((signal) => api.requests(undefined, signal), []),
    [] as RequestRecord[],
  );
  return (
    <VendorShell>
      <PageHeader
        eyebrow="Vendor workspace"
        title="Assigned repairs"
        description="See the jobs assigned to your account and respond to each offer."
        action={
          <button
            className="button secondary"
            onClick={() => void supabase?.auth.signOut()}
          >
            Sign out
          </button>
        }
      />
      {error ? <ErrorNotice message={error} onRetry={load} /> : null}
      {loading ? (
        <LoadingState label="Loading assigned repairs…" />
      ) : jobs.length ? (
        <div className="surface table-surface">
          <div className="table-wrap vendor-job-table">
            <table>
              <thead>
                <tr>
                  <th>REPAIR</th>
                  <th>PROPERTY</th>
                  <th>STATUS</th>
                  <th>NEXT STEP</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <Link
                        className="table-primary"
                        to={`/vendor/jobs/${job.id}`}
                      >
                        {job.title}
                        <span>{job.id}</span>
                      </Link>
                    </td>
                    <td>
                      {job.property} · {job.unit}
                    </td>
                    <td>
                      <Pill
                        tone={
                          job.vendorDecision === "accepted" ? "lime" : "gold"
                        }
                      >
                        {job.vendorDecision ?? "Pending response"}
                      </Pill>
                    </td>
                    <td>{job.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-repair-cards">
            {jobs.map((job) => (
              <RequestCard
                key={job.id}
                request={job}
                to={`/vendor/jobs/${encodeURIComponent(job.id)}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No assigned repairs"
          detail="New offers sent to this vendor account will appear here."
        />
      )}
    </VendorShell>
  );
}

function VendorShell({ children }: { children: ReactNode }) {
  return (
    <div className="vendor-shell">
      <header className="vendor-topbar">
        <Link to="/vendor/jobs" className="brand-row">
          <span className="brand-mark">R</span>
          <span className="brand-name">RepairLedger</span>
        </Link>
        <div className="vendor-top-actions">
          <LanguageMenu compact />
          {demoMode ? (
            <span className="avatar" aria-label="Demo vendor">
              V
            </span>
          ) : (
            <button
              className="avatar"
              aria-label="Sign out"
              onClick={() => void supabase?.auth.signOut()}
            >
              V
            </button>
          )}
        </div>
      </header>
      <main className="vendor-main">{children}</main>
    </div>
  );
}
function VendorJobPortal() {
  const { id = "" } = useParams();
  const {
    data: detail,
    setData: setDetail,
    loading,
    error,
    setError,
    refresh: load,
  } = useApiResource(
    useCallback((signal) => api.request(id, signal), [id]),
    null as RequestDetail | null,
  );
  const [saving, setSaving] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const respond = async (
    decision: "accepted" | "declined",
    reason?: string,
  ) => {
    if (!detail?.assignedVendorId) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.vendorResponse(id, {
        vendorId: detail.assignedVendorId,
        decision,
        reason,
      });
      setDetail(data);
      setDeclineOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Response could not be saved",
      );
    } finally {
      setSaving(false);
    }
  };
  const confirmVisit = async (confirmed: boolean) => {
    if (!detail?.appointment) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.confirmAppointment(
        id,
        detail.appointment.id,
        confirmed,
        "vendor",
      );
      setDetail(data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Visit response could not be saved",
      );
    } finally {
      setSaving(false);
    }
  };
  const workAction = async (action: "start" | "complete") => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await (action === "start"
        ? api.startWork(id)
        : api.completeWork(id));
      setDetail(data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Work action could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (loading)
    return (
      <VendorShell>
        <LoadingState label="Loading assigned repair…" />
      </VendorShell>
    );
  if (error && !detail)
    return (
      <VendorShell>
        <ErrorNotice message={error} onRetry={load} />
      </VendorShell>
    );
  if (!detail) return null;
  const appointment = detail.appointment;
  return (
    <VendorShell>
      <div className="vendor-heading">
        <Pill tone={detail.vendorDecision === "accepted" ? "lime" : "gold"}>
          {detail.vendorDecision ?? "Offer pending"}
        </Pill>
        <h1>{detail.title}</h1>
        <p>
          {detail.property} · Unit {detail.unit} · {detail.id}
        </p>
      </div>
      <RepairProgress request={detail} />
      {detail.residentVerification?.status === "unresolved" &&
      detail.state === "in_progress" ? (
        <div className="quote-review-banner" role="note">
          <MessageCircle size={18} />
          <div>
            <strong>Resident says the problem is still happening</strong>
            <p>
              {detail.residentVerification.note ||
                "No additional note was provided. Follow up before reporting completion again."}
            </p>
          </div>
        </div>
      ) : null}
      {detail.photoUrl ? (
        <img
          className="vendor-photo"
          src={detail.photoUrl}
          alt="Resident supplied repair evidence"
        />
      ) : (
        <div className="surface vendor-context">
          No resident attachment was added.
        </div>
      )}
      <section className="surface vendor-context">
        <Fact label="CATEGORY" value={detail.category} />
        <Fact label="DESCRIPTION" value={detail.description} />
        <Fact
          label="ACCESS"
          value={`${detail.access}${detail.accessNotes ? ` · ${detail.accessNotes}` : ""}`}
        />
        <Fact
          label="REQUESTED AVAILABILITY"
          value={detail.preferredWindow ?? "Not provided"}
        />
        <Fact
          label="APPROVED SCOPE"
          value={
            detail.estimate?.status === "approved"
              ? detail.estimate.scope
              : "No work scope approved"
          }
        />
        <Fact
          label="APPROVED LIMIT"
          value={
            detail.estimate?.status === "approved"
              ? money(detail.estimate.total, detail.estimate.currency)
              : "Not approved"
          }
        />
      </section>
      {error ? (
        <div className="notice danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      ) : null}
      {detail.vendorDecision === "pending" ? (
        <div className="vendor-actions">
          <Button disabled={saving} onClick={() => void respond("accepted")}>
            <Check size={16} /> Accept offer
          </Button>
          <Button
            variant="danger"
            disabled={saving}
            onClick={() => setDeclineOpen(true)}
          >
            Decline offer
          </Button>
        </div>
      ) : null}
      {detail.vendorDecision === "accepted" ? (
        <>
          <section className="surface detail-panel">
            <h2>Visit coordination</h2>
            {appointment ? (
              <VisitConfirmation appointment={appointment} />
            ) : (
              <p className="muted">
                The manager has not proposed a specific visit time yet.
              </p>
            )}
            {appointment?.status === "proposed" &&
            !appointment.vendorConfirmedAt ? (
              <div className="button-row">
                <Button
                  onClick={() => void confirmVisit(true)}
                  disabled={saving}
                >
                  Confirm visit
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void confirmVisit(false)}
                  disabled={saving}
                >
                  Cannot attend
                </Button>
              </div>
            ) : null}
          </section>
          {detail.estimate?.status === "approved" &&
          ["assigned", "scheduled", "approved"].includes(detail.state) ? (
            <Button
              variant="secondary"
              disabled={
                saving ||
                (detail.appointment !== undefined &&
                  detail.appointment.status !== "confirmed")
              }
              onClick={() => void workAction("start")}
            >
              Start approved work
            </Button>
          ) : !detail.estimate ||
            detail.estimate.status === "changes_requested" ? (
            <Link to={`/vendor/jobs/${id}/estimate`} className="button primary">
              Submit a quote <ArrowRight size={16} />
            </Link>
          ) : (
            <p className="muted">
              Quote status: {formatState(detail.estimate.status)}
            </p>
          )}
          {detail.state === "in_progress" ? (
            <Button
              disabled={saving}
              onClick={() => void workAction("complete")}
            >
              Mark work complete
            </Button>
          ) : null}
        </>
      ) : null}
      {declineOpen ? (
        <DeclineModal
          onClose={() => setDeclineOpen(false)}
          onDecline={(reason) => void respond("declined", reason)}
        />
      ) : null}
    </VendorShell>
  );
}
function DeclineModal({
  onClose,
  onDecline,
}: {
  onClose: () => void;
  onDecline: (reason: string) => void;
}) {
  const [reason, setReason] = useState("Unavailable at this time");
  return (
    <Modal title="Decline this offer" onClose={onClose}>
      <p className="modal-help">
        The manager will see the reason and can find another vendor.
      </p>
      <label>
        Reason
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        >
          <option>Unavailable at this time</option>
          <option>Outside service area</option>
          <option>Scope not supported</option>
          <option>Timing conflict</option>
          <option>Pricing issue</option>
        </select>
      </label>
      <div className="drawer-actions">
        <Button variant="secondary" onClick={onClose}>
          Keep offer
        </Button>
        <Button variant="danger" onClick={() => onDecline(reason)}>
          Decline offer
        </Button>
      </div>
    </Modal>
  );
}
function VendorEstimateEntry() {
  const { id = "" } = useParams();
  const {
    data: detail,
    loading,
    error: loadError,
    refresh,
  } = useApiResource(
    useCallback((signal) => api.request(id, signal), [id]),
    null as RequestDetail | null,
  );
  const [currency, setCurrency] = useState("USD");
  useEffect(() => {
    if (detail?.estimate) {
      setCurrency(quoteCurrency(detail.estimate.currency));
      setScope(detail.estimate.scope);
      setEstimate({
        labor: detail.estimate.labor,
        parts: detail.estimate.parts,
        tax: detail.estimate.tax,
      });
    }
  }, [detail]);
  const [scope, setScope] = useState("");
  const [estimate, setEstimate] = useState({ labor: 0, parts: 0, tax: 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [totalSaved, setTotalSaved] = useState(0);
  const total = estimate.labor + estimate.parts + estimate.tax;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || detail.vendorDecision !== "accepted" || saving) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.submitEstimate(id, {
        ...estimate,
        scope,
        currency,
      });
      setTotalSaved(data.total);
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Quote could not be submitted",
      );
    } finally {
      setSaving(false);
    }
  };
  if (loading)
    return (
      <VendorShell>
        <LoadingState label="Loading current quote…" />
      </VendorShell>
    );
  if (loadError || !detail)
    return (
      <VendorShell>
        <ErrorNotice
          message={loadError || "Repair not found"}
          onRetry={refresh}
        />
      </VendorShell>
    );
  const editable =
    detail.vendorDecision === "accepted" &&
    ![
      "closed",
      "cancelled",
      "verification",
      "completed",
      "invoice_review",
      "in_progress",
    ].includes(detail.state) &&
    (!detail.estimate || detail.estimate.status === "changes_requested");
  if (!editable)
    return (
      <VendorShell>
        <EmptyState
          title="This quote is not editable"
          detail="Only an accepted job with no quote, or a quote returned for changes, can be submitted."
          action={
            <Link
              className="button secondary"
              to={`/vendor/jobs/${encodeURIComponent(id)}`}
            >
              Return to job
            </Link>
          }
        />
      </VendorShell>
    );
  return (
    <VendorShell>
      <div className="crumb vendor-crumb">
        <Link to={`/vendor/jobs/${id}`}>
          <ArrowLeft size={15} /> Job details
        </Link>
        <span>/</span>
        <span>Quote</span>
      </div>
      <div className="vendor-heading">
        <span className="eyebrow">{id} · QUOTE</span>
        <h1>
          {saved
            ? "Quote submitted"
            : detail.estimate?.status === "changes_requested"
              ? "Revise your quote"
              : "Submit your quote"}
        </h1>
        <p>
          Describe the proposed work and itemize the amount. The landlord must
          approve this quote before work starts.
        </p>
      </div>
      {!saved && detail.estimate?.status === "changes_requested" ? (
        <div className="quote-review-banner" role="note">
          <MessageCircle size={18} />
          <div>
            <strong>Manager's clarification request</strong>
            <p>
              {[...detail.events]
                .reverse()
                .find(
                  (event) =>
                    event.type === "estimate-review" &&
                    event.label === "Estimate changes requested",
                )?.detail ||
                "Your manager requested changes. Review the repair history before resubmitting."}
            </p>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="notice danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      ) : null}
      {saved ? (
        <div className="estimate-sent">
          <div className="success-mark">
            <Check size={26} />
          </div>
          <h2>Quote version saved</h2>
          <p>
            {money(totalSaved, currency)} is awaiting landlord review. This
            submission does not authorize work.
          </p>
          <Link to={`/vendor/jobs/${id}`} className="button primary">
            Return to repair <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <form className="surface estimate-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="estimate-scope">Proposed scope</label>
            <textarea
              id="estimate-scope"
              required
              minLength={3}
              maxLength={4000}
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              rows={4}
              placeholder="Describe diagnosis, labor, parts, and any limits."
            />
          </div>
          <label className="field-label quote-currency-picker">
            Quote currency
            <select
              value={currency}
              disabled={saving || Boolean(detail.estimate)}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {supportedCurrencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <small>
              {detail.estimate
                ? "Revisions keep the original currency."
                : "Choose the currency for this repair. Totals are not converted."}
            </small>
          </label>
          <div className="money-grid">
            <MoneyInput
              label="Labor"
              currency={currency}
              value={estimate.labor}
              onChange={(value) => setEstimate({ ...estimate, labor: value })}
            />
            <MoneyInput
              label="Parts"
              currency={currency}
              value={estimate.parts}
              onChange={(value) => setEstimate({ ...estimate, parts: value })}
            />
            <MoneyInput
              label="Tax"
              currency={currency}
              value={estimate.tax}
              onChange={(value) => setEstimate({ ...estimate, tax: value })}
            />
          </div>
          <div className="estimate-total">
            <span>Quote total</span>
            <strong>{money(total, currency)}</strong>
          </div>
          <div className="notice">
            <FileCheck2 size={18} />
            <div>
              <strong>Approval is required</strong>
              <span>
                Do not begin the quoted work until you can see the landlord’s
                approval and amount.
              </span>
            </div>
          </div>
          <Button type="submit" disabled={saving || !scope.trim()}>
            {saving ? "Submitting…" : "Submit quote"} <ArrowRight size={16} />
          </Button>
        </form>
      )}
    </VendorShell>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  currency = "USD",
}: {
  label: string;
  currency?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={`money-${label}`}>{label}</label>
      <div className="money-input">
        <span title={currency}>{currencySymbol(currency)}</span>
        <input
          id={`money-${label}`}
          min="0"
          step="0.01"
          type="number"
          value={value}
          onChange={(event) =>
            onChange(Math.max(0, Number(event.target.value)))
          }
        />
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const overlayRef = useOverlayFocus<HTMLElement>(true, onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function formatState(state: string) {
  return state
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function downloadCsv<T extends object>(rows: T[], filename: string) {
  const records = rows as Array<Record<string, unknown>>;
  const keys = records.length
    ? Object.keys(records[0]).filter(
        (key) =>
          ![
            "events",
            "estimates",
            "appointments",
            "evidence",
            "safetyAnswers",
            "residentVerification",
          ].includes(key),
      )
    : [];
  const cell = (value: unknown) => {
    const text = String(
      typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : (value ?? ""),
    );
    return `"${(/^[=+@\\-\\t\\r]/.test(text) ? "\'" : "") + text.replaceAll('"', '""')}"`;
  };
  const csv = [
    keys.map(cell).join(","),
    ...records.map((row) => keys.map((key) => cell(row[key])).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default App;
