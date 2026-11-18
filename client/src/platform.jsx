import { Link } from "react-router-dom";
import { PlatformHealth, DataTable } from "./dashboard.jsx";
import { dateTime } from "./api.js";
import { useState } from "react";
import { request } from "./api.js";
import { useAuth, useData } from "./state.jsx";
import { Collection, Feedback, Loading } from "./operations.jsx";
export function PlatformOverview() {
  const state = useData("/admin/overview");
  const activity = useData("/audit?limit=5");
  return (
    <>
      <div className="page-actions">
        <Link className="button" to="/admin/accounts#add-professional">
          Add Professional
        </Link>
        <Link to="/admin/accounts">Manage accounts</Link>
      </div>
      <Loading state={state} />
      {state.data && (
        <div className="stats">
          {Object.entries(state.data).map(([label, value]) => (
            <div className="panel" key={label}>
              <p>
                {{
                  professionals: "Professional accounts",
                  customers: "Customer accounts",
                  admins: "Administrators",
                }[label] || label}
              </p>
              <strong className="stat-value">{value}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="overview-grid">
        <PlatformHealth />
        <section className="panel">
          <div className="section-heading">
            <h2>Recent platform activity</h2>
            <Link to="/admin/audit">View all activity</Link>
          </div>
          <Loading state={activity} />
          {activity.data?.items.length ? (
            <DataTable
              caption="Recent platform activity"
              items={activity.data.items}
              columns={[
                { label: "Action", render: (item) => item.action },
                { label: "When", render: (item) => dateTime(item.createdAt) },
              ]}
            />
          ) : (
            !activity.loading &&
            !activity.error && (
              <p className="empty-message">No platform activity yet.</p>
            )
          )}
        </section>
      </div>
    </>
  );
}
export function PlatformAccounts() {
  const { session } = useAuth();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false);
  async function create(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") || "").trim().toLowerCase();
    setBusy(true);
    try {
      const result = await request("/admin/professional-invitations", {
        method: "POST",
        body: { email },
      });
      setError("");
      setMessage(result.message);
      form.reset();
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function resendInvitation(item) {
    setBusy(true);
    try {
      const result = await request(`/admin/professional-invitations/${item._id}/resend`, { method: "POST", body: {} });
      setError("");
      setMessage(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(item) {
    try {
      await request(`/admin/accounts/${item._id}`, {
        method: "PATCH",
        body: { active: !item.active },
      });
      setError("");
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <>
      <Feedback error={error} message={message} />
      <form id="add-professional" className="panel form-grid" onSubmit={create}>
        <h2>Invite a professional securely</h2>
        <label>
          Professional email address
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        <p>A private, one-time email link verifies address ownership and lets the professional choose their own password. Business name and WhatsApp are entered by the professional; the profile stays unpublished until configured.</p>
        <p>Email delivery is currently safe-mode unless an approved SMTP provider is configured. If no email was sent, ask an admin to configure SMTP and resend; never share temporary passwords or setup links manually.</p>
        <button className="button" disabled={busy}>{busy ? "Preparing invitation…" : "Send setup invitation"}</button>
      </form>
      <Collection
        key={version}
        endpoint="/admin/accounts"
        caption="Platform accounts"
        columns={[
          { label: "Name", render: (item) => <strong>{item.name}</strong> },
          { label: "Email", render: (item) => item.email },
          { label: "Role", render: (item) => item.role },
          {
            label: "Status",
            render: (item) => (
              <span className="badge">
                {item.setupPending ? `Invitation pending · ${item.active ? "Active" : "Inactive"}` : item.active ? "Active" : "Inactive"}
              </span>
            ),
          },
          {
            label: "Action",
            render: (item) => <div className="account-actions">
              {item._id !== session.user.id ? <button onClick={() => toggle(item)}>{item.active ? "Deactivate" : "Activate"} account</button> : "Current account"}
              {item.role === "professional" && item.setupPending && <button disabled={busy} onClick={() => resendInvitation(item)}>Resend secure setup invitation</button>}
            </div>,
          },
        ]}
      >
        {(item) => (
          <>
            <h3>{item.name}</h3>
            <p>
              {item.email} · {item.role} · {item.active ? "Active" : "Inactive"}
            </p>
            {item._id !== session.user.id && (
              <button onClick={() => toggle(item)}>
                {item.active ? "Deactivate" : "Activate"} account
              </button>
            )}
          </>
        )}
      </Collection>
    </>
  );
}
export function PlatformSettingsPage() {
  const state = useData("/admin/settings");
  const { reloadBusiness } = useAuth();
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function save(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await request("/admin/settings", {
        method: "PUT",
        body: {
          platformName: form.get("platformName"),
          description: form.get("description"),
          demo: form.has("demo"),
        },
      });
      await reloadBusiness();
      setError("");
      setMessage("Shared platform settings saved.");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <>
      <Loading state={state} />
      {state.data && (
        <form className="panel form-grid" onSubmit={save}>
          <Feedback error={error} message={message} />
          <label>
            Platform name
            <input
              name="platformName"
              required
              minLength={2}
              defaultValue={state.data.platformName}
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              defaultValue={state.data.description}
            />
          </label>
          <label className="checkbox">
            <input
              name="demo"
              type="checkbox"
              defaultChecked={state.data.demo}
            />
            Clearly label demonstration platform
          </label>
          <p>
            Advertisement publication length: seven days. Professional booking
            fees and financial settings are independently owned and cannot be
            changed here.
          </p>
          <button className="button">Save platform settings</button>
        </form>
      )}
    </>
  );
}
export function ProfessionalAvailability() {
  const state = useData("/professional/availability");
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function save(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await request("/professional/availability", {
        method: "PUT",
        body: {
          weekdays: form.getAll("weekdays").map(Number),
          workStart: form.get("workStart"),
          workEnd: form.get("workEnd"),
        },
      });
      setMessage("Your availability was saved.");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <>
      <Loading state={state} />
      {state.data && (
        <form className="panel form-grid" onSubmit={save}>
          <h2>Your working availability</h2>
          <Feedback error={error} message={message} />
          <fieldset className="workdays">
            <legend>Working days</legend>
            {[
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((day, index) => (
              <label key={day} className="checkbox">
                <input
                  name="weekdays"
                  value={index}
                  type="checkbox"
                  defaultChecked={state.data.weekdays.includes(index)}
                />
                {day}
              </label>
            ))}
          </fieldset>
          <label>
            Work starts
            <input
              name="workStart"
              type="time"
              required
              defaultValue={state.data.workStart}
            />
          </label>
          <label>
            Work ends
            <input
              name="workEnd"
              type="time"
              required
              defaultValue={state.data.workEnd}
            />
          </label>
          <button className="button">Save my availability</button>
        </form>
      )}
    </>
  );
}
