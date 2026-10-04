import { useCallback, useState } from "react";
import { request } from "../../api";
import { useApiResource } from "../../hooks/useApiResource";
import type { UserDirectory } from "../../../../../shared/userManagement";
import { Button } from "../../components/common";
import { communityApi } from "./api";
import {
  Action,
  Card,
  Form,
  None,
  Status,
  amount,
  opts,
  partyName,
  partyOptions,
  today,
  unitName,
  unitOptions,
  type ModuleProps,
} from "./ui";
import type { Expense } from "../../../../../shared/community";

export function Finance({ data: d, role, mutate, busy }: ModuleProps) {
  const directory=useApiResource<UserDirectory|null>(useCallback(signal=>d.canManage?request<{data:UserDirectory}>("/api/admin/users",{signal}):Promise.resolve({data:null}),[d.canManage]),null);
  const [view, setView] = useState("rent");
  const manageRent = d.canManage || ["unit_owner", "operator"].includes(role);
  const currencies = [
    ...new Set([
      ...d.charges.map((c) => c.currency),
      ...d.expenses.map((e) => e.currency),
    ]),
  ];
  return (
    <div className="community-stack">
      <div className="community-subtabs">
        {["rent", "expenses", "ownership"].map((tab) => (
          <Button
            key={tab}
            variant={view === tab ? "primary" : "secondary"}
            onClick={() => setView(tab)}
          >
            {tab === "rent"
              ? "Rent & deposits"
              : tab === "expenses"
                ? "Expenses"
                : "Owners & agreements"}
          </Button>
        ))}
      </div>
      <div className="community-grid">
        {currencies.map((currency) => (
          <Card key={currency} title={currency}>
            <dl className="community-facts">
              <div>
                <dt>Rent billed</dt>
                <dd>
                  {amount(
                    d.charges
                      .filter(
                        (c) => c.currency === currency && c.kind === "rent",
                      )
                      .reduce((s, c) => s + c.amount, 0),
                    currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Verified rent</dt>
                <dd>
                  {amount(
                    d.charges
                      .filter(
                        (c) => c.currency === currency && c.kind === "rent",
                      )
                      .reduce((s, c) => s + c.verifiedPaid, 0),
                    currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Deposits held</dt>
                <dd>
                  {amount(
                    d.charges
                      .filter(
                        (c) => c.currency === currency && c.kind === "deposit",
                      )
                      .reduce((s, c) => s + c.verifiedPaid, 0),
                    currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Expenses recorded</dt>
                <dd>
                  {amount(
                    d.expenses
                      .filter((e) => e.currency === currency)
                      .reduce((s, e) => s + e.amount, 0),
                    currency,
                  )}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
      {view === "rent" && (
        <>
          {manageRent && (
            <Form
              title="Generate monthly rent"
              fields={[
                {
                  name: "month",
                  label: "Billing month",
                  type: "month",
                  value: today(d.property.timezone).slice(0, 7),
                },
              ]}
              busy={busy}
              onSubmit={(v) => mutate("rent/generate", { month: v.month })}
            >
              <p className="community-muted">
                Creates each agreement's rent once. Partial months are prorated.
                Master rent and subtenant rent are separate obligations.
              </p>
            </Form>
          )}
          <Card
            title="Rent and deposit ledger"
            detail="A reported payment stays pending until the creditor or manager verifies it. Deposits are listed separately from rental income."
          >
            {!d.charges.length && <None />}
            {d.charges.map((c) => {
              const a = d.agreements.find((a) => a.id === c.agreementId);
              const remaining = c.amount - c.verifiedPaid;
              const canPay =
                d.canManage ||
                role === "tenant" ||
                (role === "operator" &&
                  d.myPartyIds.includes(a?.debtorPartyId ?? ""));
              const canVerify =
                d.canManage ||
                (["operator", "unit_owner"].includes(role) &&
                  d.myPartyIds.includes(a?.creditorPartyId ?? ""));
              return (
                <article className="community-record" key={c.id}>
                  <div className="community-spread">
                    <h3>
                      {c.kind === "deposit"
                        ? "Security deposit"
                        : c.period + " rent"}{" "}
                      <Status
                        value={
                          remaining <= 0
                            ? "paid"
                            : c.dueOn < today(d.property.timezone)
                              ? "overdue"
                              : "unpaid"
                        }
                      />
                    </h3>
                    <strong>{amount(remaining, c.currency)} remaining</strong>
                  </div>
                  <p>
                    {partyName(d, a?.debtorPartyId)} →{" "}
                    {partyName(d, a?.creditorPartyId)} · {a?.kind} ·{" "}
                    {a?.unitIds.map((id) => unitName(d, id)).join(", ")} · Due{" "}
                    {c.dueOn}
                  </p>
                  <p className="community-muted">
                    Billed {amount(c.amount, c.currency)} · Verified{" "}
                    {amount(c.verifiedPaid, c.currency)}
                  </p>
                  {canPay && remaining > 0 && (
                    <Form
                      title="Report payment"
                      submit="Report for verification"
                      fields={[
                        {
                          name: "amount",
                          label: "Amount",
                          type: "number",
                          value: remaining,
                          min: 0.01,
                          max: remaining,
                        },
                        {
                          name: "reference",
                          label: "Bank / UPI / cash reference",
                        },
                      ]}
                      busy={busy}
                      onSubmit={(v) =>
                        mutate("payments", {
                          chargeId: c.id,
                          amount: v.amount,
                          reference: v.reference,
                          submissionId: v.__submissionId,
                        })
                      }
                    />
                  )}
                  {d.payments
                    .filter((p) => p.chargeId === c.id)
                    .map((p) => (
                      <div className="community-payment" key={p.id}>
                        <span>
                          {amount(p.amount, c.currency)} · {p.reference}{" "}
                          <Status value={p.status} />
                          {p.status === "verified" && (
                            <small>
                              {" "}
                              Receipt {p.id.slice(0, 8).toUpperCase()}
                            </small>
                          )}
                        </span>
                        {canVerify && p.status === "pending" && (
                          <div className="community-actions">
                            <Action
                              path="payments"
                              row={p}
                              action="verify"
                              label="Verify receipt"
                              mutate={mutate}
                              busy={busy}
                            />
                            <Action
                              path="payments"
                              row={p}
                              action="reject"
                              label="Reject"
                              mutate={mutate}
                              busy={busy}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                </article>
              );
            })}
          </Card>
        </>
      )}
      {view === "expenses" && (
        <>
          {manageRent && (
            <Form
              title="Record expense"
              busy={busy}
              fields={[
                {
                  name: "scope",
                  label: "Expense belongs to",
                  options: opts(
                    ...(d.canManage
                      ? ["community", "unit", "operator"]
                      : role === "operator"
                        ? ["operator"]
                        : ["unit"]),
                  ),
                  value: d.canManage
                    ? "community"
                    : role === "operator"
                      ? "operator"
                      : "unit",
                },
                {
                  name: "unitId",
                  label: "Unit (for unit expenses)",
                  options: unitOptions(d),
                  optional: true,
                },
                {
                  name: "partyId",
                  label: "Operator (for operator expenses)",
                  options: partyOptions(d),
                  optional: true,
                },
                {
                  name: "category",
                  label: "Category",
                  options: opts(
                    "Maintenance",
                    "Utilities",
                    "Salary",
                    "Supplies",
                    "Insurance",
                    "Other",
                  ),
                  value: "Maintenance",
                },
                { name: "description", label: "Description", type: "textarea" },
                { name: "amount", label: "Amount", type: "number", min: 0.01 },
                { name: "currency", label: "Currency", value: "INR" },
                {
                  name: "incurredOn",
                  label: "Date",
                  type: "date",
                  value: today(d.property.timezone),
                },
                {
                  name: "paidStatus",
                  label: "Payment state",
                  options: opts("unpaid", "paid"),
                  value: "unpaid",
                },
                ...d.parties.map((p) => ({
                  name: "allocation:" + p.id,
                  label: "Allocate to " + p.name,
                  type: "number",
                  optional: true,
                  hint: "Optional; enter amounts for every party sharing this expense.",
                })),
              ]}
              onSubmit={(v) =>
                mutate("expenses", {
                  ...v,
                  unitId: v.unitId || null,
                  partyId: v.partyId || null,
                  allocations: d.parties
                    .map((p) => ({
                      partyId: p.id,
                      amount: Number(v["allocation:" + p.id]),
                    }))
                    .filter((a) => a.amount > 0),
                })
              }
            >
              <p className="community-muted">
                If no custom allocation is supplied, unit expenses use the
                expense shares effective on that date when they total 100%.
              </p>
            </Form>
          )}
          <Card title="Expenses">
            {!d.expenses.length && <None />}
            {d.expenses.map((e) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                data={d}
                role={role}
                mutate={mutate}
                busy={busy}
              />
            ))}
          </Card>
        </>
      )}
      {view === "ownership" && (
        <>
          {d.canManage && (
            <Card
              title="Ownership setup"
              detail="Choose a community account from People & access. Ownership, income shares and expense shares are independent."
            >
              <Form
                title="Add person or company"
                busy={busy}
                fields={[
                  { name: "name", label: "Name" },
                  {
                    name: "kind",
                    label: "Kind",
                    options: opts("person", "company"),
                    value: "person",
                  },
                  {
                    name: "userId",
                    label: "Community account (optional)",
                      options: directory.data?.users.filter(u=>u.status==='active').map(u=>({id:u.userId,name:`${u.displayName||u.email} · ${u.role.replaceAll('_',' ')}`}))??[],
                    optional: true,
                    hint: "A company can remain unbound. Create missing accounts under People & access.",
                  },
                ]}
                onSubmit={(v) =>
                  mutate("parties", { ...v, userId: v.userId || null })
                }
              />
              <Form
                title="Assign ownership share"
                busy={busy}
                fields={[
                  {
                    name: "unitId",
                    label: "Flat or shop",
                    options: unitOptions(d),
                  },
                  {
                    name: "partyId",
                    label: "Owner / shareholder",
                    options: partyOptions(d),
                  },
                  {
                    name: "share",
                    label: "Ownership %",
                    type: "number",
                    value: 100,
                    min: 0.01,
                    max: 100,
                  },
                  {
                    name: "incomeShare",
                    label: "Income %",
                    type: "number",
                    value: 100,
                    max: 100,
                  },
                  {
                    name: "expenseShare",
                    label: "Expense %",
                    type: "number",
                    value: 100,
                    max: 100,
                  },
                  {
                    name: "startsOn",
                    label: "Effective from",
                    type: "date",
                    value: today(d.property.timezone),
                  },
                  {
                    name: "endsOn",
                    label: "Exclusive end (optional)",
                    type: "date",
                    optional: true,
                  },
                ]}
                onSubmit={(v) =>
                  mutate("ownerships", { ...v, endsOn: v.endsOn || null })
                }
              />
              <p className="community-muted">Your account: {d.userId}</p>
            </Card>
          )}
          <Card title="Owners and shareholders">
            {!d.ownerships.length && <None />}
            {d.ownerships.map((o) => (
              <article key={o.id} className="community-record">
                <h3>
                  Unit {unitName(d, o.unitId)} · {partyName(d, o.partyId)}
                </h3>
                <p>
                  Ownership {o.share}% · Income {o.incomeShare}% · Expense{" "}
                  {o.expenseShare}%
                </p>
                <p className="community-muted">
                  {o.startsOn} → {o.endsOn ?? "Open-ended"} (end exclusive)
                </p>
                {d.canManage && !o.endsOn && (
                  <Form
                    title="End ownership"
                    busy={busy}
                    fields={[
                      {
                        name: "endsOn",
                        label: "End date",
                        type: "date",
                        value: today(d.property.timezone),
                      },
                    ]}
                    onSubmit={(v) =>
                      mutate(`ownerships/${o.id}/end`, {
                        endsOn: v.endsOn,
                        revision: o.revision,
                      })
                    }
                  />
                )}
              </article>
            ))}
          </Card>
          {manageRent && (
            <Form
              title="Create rental agreement"
              busy={busy}
              fields={[
                {
                  name: "kind",
                  label: "Arrangement",
                  options: opts(
                    ...(role === "operator"
                      ? ["sublease"]
                      : ["direct", "master", "sublease"]),
                  ),
                  value: role === "operator" ? "sublease" : "direct",
                },
                {
                  name: "creditorPartyId",
                  label: "Landlord / operator receiving rent",
                  options: partyOptions(d),
                },
                {
                  name: "debtorPartyId",
                  label: "Tenant / operator paying rent",
                  options: partyOptions(d),
                },
                {
                  name: "parentId",
                  label: "Master agreement (sublease only)",
                  options: d.agreements
                    .filter((a) => a.kind === "master")
                    .map((a) => ({
                      id: a.id,
                      name: `${partyName(d, a.debtorPartyId)} · ${a.unitIds.map((id) => unitName(d, id)).join(", ")}`,
                    })),
                  optional: true,
                },
                {
                  name: "unitIds",
                  label: "Units covered",
                  options: unitOptions(d),
                  multiple: true,
                  hint: "Select several units for a floor lease.",
                },
                {
                  name: "occupancyId",
                  options:d.canManage?(directory.data?.users.filter(u=>u.status==='active').flatMap(u=>u.memberships.filter(m=>m.propertyId===d.property.id&&m.occupancyId).map(m=>({id:m.occupancyId!,name:`${u.displayName||u.email} · ${m.unitLabel||'unit'}`})))??[]):undefined,
                  label: "Resident occupancy UUID",
                  optional: true,
                  hint: "Required for direct rentals and subleases; must match trusted resident metadata.",
                },
                {
                  name: "startsOn",
                  label: "Start",
                  type: "date",
                  value: today(d.property.timezone),
                },
                { name: "endsOn", label: "Exclusive end", type: "date" },
                {
                  name: "rent",
                  label: "Monthly rent",
                  type: "number",
                  min: 0.01,
                },
                {
                  name: "deposit",
                  label: "Security deposit",
                  type: "number",
                  value: 0,
                },
                { name: "currency", label: "Currency", value: "INR" },
                {
                  name: "dueDay",
                  label: "Due day (1–28)",
                  type: "number",
                  value: 5,
                  min: 1,
                  max: 28,
                },
              ]}
              onSubmit={(v) =>
                mutate("agreements", {
                  ...v,
                  parentId: v.parentId || null,
                  occupancyId: v.occupancyId || null,
                })
              }
            />
          )}
          <Card
            title="Linked rental agreements"
            detail="The operator pays the owner under a master lease. Residents pay the operator under separate subleases."
          >
            {!d.agreements.length && <None />}
            {d.agreements.map((a) => (
              <article key={a.id} className="community-record">
                <h3>
                  {partyName(d, a.debtorPartyId)} →{" "}
                  {partyName(d, a.creditorPartyId)} <Status value={a.kind} />
                </h3>
                <p>
                  {a.unitIds.map((id) => unitName(d, id)).join(", ")} ·{" "}
                  {amount(a.rent, a.currency)} / month · Deposit{" "}
                  {amount(a.deposit, a.currency)}
                </p>
                <p>
                  {a.startsOn} → {a.endsOn} · Due day {a.dueDay}
                  {a.parentId && " · Linked master " + a.parentId.slice(0, 8)}
                </p>
                {(d.canManage ||
                  (d.myPartyIds.includes(a.creditorPartyId) && manageRent)) && (
                  <Form
                    title="End agreement"
                    busy={busy}
                    fields={[
                      {
                        name: "endsOn",
                        label: "Exclusive end",
                        type: "date",
                        value: today(d.property.timezone),
                      },
                    ]}
                    onSubmit={(v) =>
                      mutate(`agreements/${a.id}/end`, {
                        endsOn: v.endsOn,
                        revision: a.revision,
                      })
                    }
                  />
                )}
              </article>
            ))}
          </Card>
        </>
      )}
      {d.canManage && d.audit.length > 0 && (
        <details className="community-card">
          <summary>Recent activity</summary>
          {d.audit
            .slice(-20)
            .reverse()
            .map((a) => (
              <p key={a.id} className="community-muted">
                {new Date(a.createdAt).toLocaleString()} · {a.action} ·{" "}
                {a.entityId.slice(0, 8)}
              </p>
            ))}
        </details>
      )}
    </div>
  );
}
function ExpenseRow({
  expense: e,
  ...props
}: ModuleProps & { expense: Expense }) {
  const { data: d, mutate, busy } = props;
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File) => {
    setError("");
    setUploading(true);
    try {
      const { data: signed } = await communityApi.send<{
        receiptId: string;
        signedUrl: string;
      }>(d.property.id, `expenses/${e.id}/receipts`, {
        name: file.name,
        contentType: file.type,
        size: file.size,
      });
      const result = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Receipt upload failed. Try again.");
      await mutate(`receipts/${signed.receiptId}/complete`, {
        action: "complete",
        revision: 0,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };
  return (
    <article className="community-record">
      <div className="community-spread">
        <h3>
          {e.category} · {e.description}
        </h3>
        <strong>{amount(e.amount, e.currency)}</strong>
      </div>
      <p>
        {e.scope} · {unitName(d, e.unitId)} · {e.incurredOn}{" "}
        <Status value={e.paidStatus} />
      </p>
      {e.allocations.map((a) => (
        <p className="community-muted" key={a.partyId}>
          {partyName(d, a.partyId)}: {amount(a.amount, e.currency)}
        </p>
      ))}
      <div className="community-actions">
        <Action
          path="expenses"
          row={e}
          action={e.paidStatus === "paid" ? "unpaid" : "paid"}
          label={e.paidStatus === "paid" ? "Mark unpaid" : "Mark paid"}
          mutate={mutate}
          busy={busy}
        />
        {(d.canManage || e.userId === d.userId) && (
          <label className="community-upload">
            {uploading ? "Uploading…" : "Attach receipt"}
            <input
              type="file"
              disabled={uploading || busy}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = "";
              }}
            />
          </label>
        )}
        {d.receipts
          .filter((r) => r.expenseId === e.id && r.status === "ready")
          .map((r) => (
            <Button
              variant="ghost"
              key={r.id}
              onClick={() =>
                void communityApi
                  .receiptUrl(d.property.id, r.id)
                  .then((result) =>
                    window.open(
                      result.data.url,
                      "_blank",
                      "noopener,noreferrer",
                    ),
                  )
                  .catch((error) => setError(String(error)))
              }
            >
              {r.name}
            </Button>
          ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
