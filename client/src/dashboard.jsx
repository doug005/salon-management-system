import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, useData } from "./state.jsx";
import { request, dateTime, money, mediaUrl } from "./api.js";
import { Badge, Loading } from "./operations.jsx";
import { useLanguage } from "./i18n.jsx";

export function DataTable({ caption, columns, items }) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="data-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr className="record" key={item._id || index}>
              {columns.map((c) => (
                <td key={c.label}>{c.render(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
// Existing API is paginated by creation time. Read every page before deriving a calendar view.
export function useAppointmentCalendar() {
  const { session } = useAuth();
  const identity = session?.user.id;
  const [state, setState] = useState({
    identity: null,
    loading: true,
    data: null,
    error: "",
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    async function read() {
      const items = [];
      for (let page = 1; ; page++) {
        const result = await request("/appointments?limit=100&page=" + page);
        if (!alive) return;
        items.push(...result.items);
        if (page * result.limit >= result.total) break;
      }
      if (alive) setState({ identity, loading: false, error: "", data: items });
    }
    read().catch((e) => {
      if (alive)
        setState({ identity, loading: false, error: e.message, data: null });
    });
    return () => {
      alive = false;
    };
  }, [identity, version]);
  return {
    ...(state.identity === identity
      ? state
      : { loading: true, data: null, error: "" }),
    reload: () => setVersion((v) => v + 1),
  };
}
const localDate = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Maseru",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const current = (a) =>
  !["cancelled", "completed", "no_show"].includes(a.status);
export function AppointmentSummary({ title, items, customer = false }) {
  const { t } = useLanguage();
  return (
    <section className="panel dashboard-section">
      <div className="section-heading">
        <h2>{title}</h2>
        <Link
          to={customer ? "/account/appointments" : "/professional/appointments"}
        >
          {t("Manage appointments")}
        </Link>
      </div>
      {items.length ? (
        <DataTable
          caption={title}
          items={items}
          columns={[
            {
              label: t("Appointment"),
              render: (a) => (
                <>
                  <strong>{a.serviceName}</strong>
                  <small>{a.reference}</small>
                </>
              ),
            },
            { label: t("Date & time"), render: (a) => dateTime(a.startsAt) },
            {
              label: t(customer ? "Professional" : "Customer"),
              render: (a) =>
                customer ? a.professional?.name : (a.customer?.name || a.guestCustomer?.name),
            },
            { label: t("Status"), render: (a) => <Badge value={a.status} /> },
            { label: t("Total"), render: (a) => money(a.totalLisente) },
          ]}
        />
      ) : (
        <p className="empty-message">{t("No appointments to show.")}</p>
      )}
    </section>
  );
}
function useLocalClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function ProfessionalOverview() {
  const { t } = useLanguage();
  const now = useLocalClock();
  const stats = useData("/professional/overview");
  const profile = useData("/professional/settings");
  const calendar = useAppointmentCalendar();
  const today = (calendar.data || [])
    .filter((a) => localDate(a.startsAt) === localDate(now))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const upcoming = (calendar.data || [])
    .filter((a) => current(a) && +new Date(a.startsAt) > now)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  return (
    <>
      <div className="page-actions">
        <Link className="button" to="/professional/book">
          {t("New booking")}
        </Link>
        <Link to="/professional/availability">{t("Manage availability")}</Link>
      </div>
      <Loading state={stats} />
      {!profile.loading && profile.data && !profile.data.whatsappNumber && (
        <p className="notice" role="alert">
          Add a valid international WhatsApp number before accepting online booking requests. <Link to="/professional/settings">Complete business settings</Link>
        </p>
      )}
      <Loading state={calendar} />
      {stats.data && (
        <div className="stats">
          {[
            [
              t("Total Appointments"),
              stats.data.appointments,
              "appointments",
            ],
            [
              t("Pending confirmations"),
              stats.data.pendingConfirmations,
              "pending-confirmations",
            ],
            [t("Customers"), stats.data.customers, "customers"],
          ].map(([label, value, path]) => (
            <Link className="panel" key={label} to={"/professional/" + path}>
              <p>{label}</p>
              <strong className="stat-value">{value}</strong>
              <small>{t("View details")} →</small>
            </Link>
          ))}
        </div>
      )}
      {calendar.data && (
        <>
          <AppointmentSummary title={t("Today's appointments")} items={today} />
          <AppointmentSummary
            title={t("Upcoming bookings")}
            items={upcoming.slice(0, 10)}
          />
          {upcoming.length > 10 && (
            <p>
              Showing the next 10 bookings. Open appointments for the full list.
            </p>
          )}
        </>
      )}
      <section className="panel">
        <h2>{t("Manage your business")}</h2>
        <div className="quick-links">
          <Link to="/professional/services">{t("Services & prices")}</Link>
          <Link to="/professional/advertisements">{t("Advertisements")}</Link>
          <Link to="/professional/reports">{t("Financial reports")}</Link>
          <Link to="/professional/settings">{t("Business & WhatsApp settings")}</Link>
        </div>
      </section>
    </>
  );
}
export function CustomerOverview() {
  const { t } = useLanguage();
  const now = useLocalClock();
  const state = useAppointmentCalendar();
  const upcoming = (state.data || [])
    .filter((a) => current(a) && +new Date(a.startsAt) >= now)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  return (
    <>
      <div className="page-actions">
        <Link className="button" to="/account/book">
          {t("Book a service")}
        </Link>
        <Link to="/account/professionals">{t("Browse professionals")}</Link>
      </div>
      <Loading state={state} />
      {state.data && (
        <>
          <div className="stats">
            <div className="panel">
              <p>{t("Upcoming appointments")}</p>
              <strong className="stat-value">{upcoming.length}</strong>
            </div>
            <div className="panel">
              <p>{t("Awaiting payment")}</p>
              <strong className="stat-value">
                {upcoming.filter((a) => a.status === "awaiting_payment").length}
              </strong>
            </div>
            <div className="panel">
              <p>{t("Completed visits")}</p>
              <strong className="stat-value">
                {state.data.filter((a) => a.status === "completed").length}
              </strong>
            </div>
          </div>
          <AppointmentSummary
            title={t("Upcoming appointments")}
            items={upcoming.slice(0, 10)}
            customer
          />
        </>
      )}
      <section className="panel">
        <h2>{t("Payment & booking help")}</h2>
        <p>
          Arrange payment directly with your professional. Your appointment is
          confirmed only after they independently verify receipt. You can find
          the booking reference, policy and WhatsApp assistance in your
          appointment details.
        </p>
        <div className="quick-links">
          <Link to="/account/payments">{t("Payment status")}</Link>
          <Link to="/account/appointments">
            {t("Manage or cancel an appointment")}
          </Link>
          <Link to="/account/history">{t("Booking history")}</Link>
        </div>
      </section>
    </>
  );
}
export function ProfessionalDirectory() {
  const state = useData("/public/professionals");
  return (
    <>
      <Loading state={state} />
      {state.data?.items.length === 0 && (
        <p className="empty-message">
          No professionals have published a profile yet.
        </p>
      )}
      <div className="directory-grid">
        {state.data?.items.map((p) => (
          <article className="panel" key={p.professional}>
            {p.photoUrl && <img className="directory-photo" src={mediaUrl(p.photoUrl)} alt={`${p.salonName} profile`} loading="lazy" />}
            <h2>{p.salonName}</h2>
            {p.demo && <span className="badge">Demonstration</span>}
            <p>{p.description}</p>
            <p>{p.address || "Location not provided"}</p>
            <div className="quick-links">
              <Link to={"/professionals/" + p.professional} state={{ returnTo: "/account/professionals", returnLabel: "← Back to browse professionals" }}>
                View public profile
              </Link>
              <Link to="/account/book">Book a service</Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
export function PlatformHealth() {
  const state = useData("/health");
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Platform health</h2>
        <button onClick={state.reload}>Refresh health</button>
      </div>
      <Loading state={state} />
      {state.data && (
        <dl className="health-list">
          <dt>API & database</dt>
          <dd>
            {state.data.status === "ok"
              ? "Available"
              : state.data.status === "database_unavailable"
                ? "Database unavailable"
                : "Unknown"}
          </dd>
          <dt>Notification mode</dt>
          <dd>
            {state.data.emailMode === "safe"
              ? "Safe mode — no real email"
              : state.data.emailMode}
          </dd>
          <dt>Business timezone</dt>
          <dd>{state.data.timeZone}</dd>
          <dt>Currency</dt>
          <dd>{state.data.currency} (M)</dd>
        </dl>
      )}
    </section>
  );
}
