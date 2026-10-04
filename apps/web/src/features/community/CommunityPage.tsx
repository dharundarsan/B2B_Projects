import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Building2, RefreshCw } from "lucide-react";
import { Button, ErrorNotice, LoadingState } from "../../components/common";
import { viewHome } from "../../../../../shared/accountView";
import { communityApi } from "./api";
import { Finance } from "./Finance";
import { Market } from "./Market";
import { Services } from "./Services";
import { Operations } from "./Operations";
import { BuildingMap } from "./BuildingMap";
import { UserManagement } from "./UserManagement";
import { Overview } from "./Overview";
import { AdminCenter, ActionCenter, ManagementReports } from "./AdminCenter";
import { useAccountView } from "../AccountView";
import { useWorkspace } from "./WorkspaceContext";

export function CommunityPage({ mode }: { mode: 1 | 2 | 3 }) {
  const { view } = useAccountView();
  const [params] = useSearchParams();
  const { context, selected, section } = useWorkspace();
  if (view.userContext !== mode)
    return (
      <Navigate
        to={{
          pathname: viewHome(view.userContext, view.role),
          search:
            params.get("property") || selected
              ? new URLSearchParams({
                  property: params.get("property") || selected,
                }).toString()
              : "",
        }}
        replace
      />
    );
  if (section === "people" && mode === 2)
    return <UserManagement properties={context.data?.properties ?? []} />;
  if (context.loading && !context.data) return <LoadingState />;
  if (context.error && !context.data) return null;
  if (!selected)
    return (
      <section className="community-card ch-empty">
        <Building2 size={38} />
        <h2>Your community starts here</h2>
        <p>
          {mode === 2
            ? "Create your first community, then add blocks, flats and invite your people."
            : "Ask your administrator to assign your account to a building."}
        </p>
        {mode === 2 && (
          <Link className="button primary" to="/properties">
            Set up communities
          </Link>
        )}
      </section>
    );
  return <CommunityBuilding key={selected} mode={mode} />;
}
function CommunityBuilding({ mode }: { mode: 1 | 2 | 3 }) {
  const { resource, selected, section, go } = useWorkspace();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const mutate = async (path: string, body: unknown, method = "POST") => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await communityApi.send(selected, path, body, method);
      setMessage("Saved.");
      resource.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (
    resource.loading &&
    (!resource.data || resource.data.property.id !== selected)
  )
    return <LoadingState label="Loading your community…" />;
  if (
    resource.error ||
    !resource.data ||
    resource.data.property.id !== selected
  )
    return (
      <ErrorNotice
        message={resource.error || "Building unavailable."}
        onRetry={resource.refresh}
      />
    );
  const data = resource.data;
  const props = { data, role: data.role, mutate, busy };
  const query = params.get("query") ?? "";
  const marketView =
    section === "orders" || section === "groups"
      ? section
      : params.get("tab") === "orders"
        ? "orders"
        : params.get("tab") === "shop" || (query && mode !== 3) || mode === 1
          ? "shop"
          : "sell";
  return (
    <>
      <div className="ch-data-bar">
        <small>{data.property.address}</small>
        <Button
          variant="ghost"
          onClick={resource.refresh}
          disabled={resource.loading}
        >
          <RefreshCw size={14} />
          {resource.loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {error && <ErrorNotice message={error} onRetry={() => setError("")} />}
      {message && (
        <p role="status" className="community-success">
          {message}
        </p>
      )}
      {section === "admin-center" && mode === 2 ? (
        <AdminCenter data={data} />
      ) : section === "actions" ? (
        <ActionCenter data={data} mode={mode} />
      ) : section === "reports" && mode === 2 ? (
        <ManagementReports data={data} />
      ) : section === "overview" ? (
        <Overview data={data} mode={mode} change={go} />
      ) : ["market", "orders", "groups"].includes(section) ? (
        <Market
          key={section + marketView + query}
          {...props}
          initialView={marketView}
          initialSearch={query}
        />
      ) : section === "services" ? (
        <Services key={query} {...props} initialSearch={query} />
      ) : section === "finance" ? (
        <Finance {...props} />
      ) : section === "map" ? (
        <BuildingMap {...props} />
      ) : (
        <Operations {...props} section={section} />
      )}
    </>
  );
}
