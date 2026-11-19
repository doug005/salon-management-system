import { DataTable } from "./dashboard.jsx";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { request, money, dateTime, acceptSession, mediaUrl } from "./api.js";
import { useAuth, useData } from "./state.jsx";
import { normalizeInternationalPhone } from "./phone.js";
import { useLanguage } from "./i18n.jsx";
import { useOnline } from "./offline.jsx";
export function Feedback({ error, message }) {
  const { t } = useLanguage();
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {t(message)}
        </p>
      )}
    </>
  );
}
export function Loading({ state }) {
  const { t } = useLanguage();
  return state.error ? (
    <div><p className="error" role="alert">{state.error}</p>{state.reload && <button type="button" onClick={state.reload}>{t("Try again")}</button>}</div>
  ) : state.loading ? (
    <p role="status">{t("Loading…")}</p>
  ) : null;
}
export function WhatsApp({ appointment }) {
  const { t } = useLanguage();
  const id =
    typeof appointment?.professional === "object"
      ? appointment.professional?._id
      : appointment?.professional;
  const profile = useData(
    id ? `/public/professionals/${id}` : "/public/settings",
  );
  const business = profile.data;
  if (!business?.whatsappNumber)
    return (
      <p>{t("Professional WhatsApp contact is not configured or not published.")}</p>
    );
  const message = appointment
    ? `Hello, I would like to book an appointment.\n\nService: ${appointment.serviceName}\nDate and time: ${dateTime(appointment.startsAt)} (Africa/Maseru)\nBooking Reference: ${appointment.reference}\nBooking Fee: ${money(appointment.feeLisente)}\n\nPlease let me know how I can complete the booking fee payment. This message does not confirm payment.`
    : "Hello, I would like assistance with a visit and external manual payment.";
  return (
    <a
      className="button"
      target="_blank"
      rel="noreferrer"
      href={`https://wa.me/${String(business.whatsappNumber).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`}
    >
      {t("Open WhatsApp")}
    </a>
  );
}
const personNamePattern = /^[\p{L}\p{M}]+(?:[ '\u2019\u02bc-]+[\p{L}\p{M}]+)*$/u;
const todayInMaseru = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Maseru", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const validCalendarDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
};
export function Booking({ embedded = false }) {
  const { t } = useLanguage();
  const { session, loading } = useAuth();
  const online = useOnline();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const own = session?.user.role === "professional";
  const [selectedProfessional, setProfessional] = useState(searchParams.get("professional") || ""),
    [service, setService] = useState(searchParams.get("service") || ""),
    [day, setDay] = useState(searchParams.get("date") || ""),
    [time, setTime] = useState(searchParams.get("time") || ""),
    [customer, setCustomer] = useState(""),
    [bookingMode, setBookingMode] = useState("phone"),
    [guestName, setGuestName] = useState(""),
    [guestPhone, setGuestPhone] = useState(""),
    [guestWhatsApp, setGuestWhatsApp] = useState(""),
    [fieldErrors, setFieldErrors] = useState({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [created, setCreated] = useState(null),
    [confirming, setConfirming] = useState(false);
  const submitting = useRef(false);
  const formRef = useRef(null);
  const professional = own ? session.user.id : selectedProfessional;
  const professionals = useData("/public/professionals");
  const services = useData(
    own
      ? "/services?limit=100"
      : `/public/services?limit=100${professional ? "&professional=" + professional : ""}`,
  );
  const profile = useData(
    own
      ? "/professional/settings"
      : professional
        ? `/public/professionals/${professional}`
        : "/public/settings",
  );
  const customers = useData(
    own ? "/customers?limit=100" : "/public/professionals",
  );
  const slots = useData(
    service && professional && day
      ? own
        ? `/professional/availability/slots?service=${service}&date=${day}`
        : `/public/availability?service=${service}&professional=${professional}&date=${day}`
      : "/public/professionals",
  );
  const business = professional ? profile.data : null;
  const selected = services.data?.items.find((s) => s._id === service);
  const bookingPath = (() => {
    const params = new URLSearchParams();
    if (professional) params.set("professional", professional);
    if (service) params.set("service", service);
    if (day) params.set("date", day);
    if (time) params.set("time", time);
    return `/book${params.toString() ? `?${params}` : ""}`;
  })();
  const loginPath = `/login?next=${encodeURIComponent(bookingPath)}`;
  const registerPath = `/register?next=${encodeURIComponent(bookingPath)}`;
  function clearFieldError(field) {
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  }
  function submit(e) {
    e.preventDefault();
    setError("");
    if (!online) {
      setError(t("You are offline. Booking requests are not saved or queued. Reconnect before booking."));
      return;
    }
    const errors = {};
    if (!professional || !services.data?.items.some((item) => item._id === service && item.active && String(item.professional) === String(professional)))
      errors.service = "Choose an active service offered by this professional.";
    if (!validCalendarDate(day) || day < todayInMaseru())
      errors.day = "Choose a valid date today or later in Africa/Maseru.";
    if (!slots.data?.slots?.includes(time))
      errors.time = "Choose one of the currently available appointment times.";
    if (own && bookingMode === "phone") {
      const name = guestName.trim();
      if (name.length < 2 || name.length > 100 || !personNamePattern.test(name))
        errors.guestName = "Enter a valid customer name using letters, spaces, apostrophes, or hyphens.";
      if (!normalizeInternationalPhone(guestPhone))
        errors.guestPhone = "Enter a valid international customer phone number, including country code.";
      if (guestWhatsApp && !normalizeInternationalPhone(guestWhatsApp))
        errors.guestWhatsApp = "Enter a valid international WhatsApp number, including country code, or leave blank.";
    }
    if (own && bookingMode === "registered" && !customers.data?.items.some((item) => item._id === customer))
      errors.customer = "Choose a customer associated with your business.";
    if (!formRef.current?.querySelector('input[type="checkbox"]')?.checked)
      errors.policy = "Accept the professional's booking fee and policy to continue.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Please correct the highlighted booking details.");
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    if (!session) {
      navigate(loginPath);
      return;
    }
    setConfirming(true);
  }
  async function confirmBooking() {
    if (submitting.current || !formRef.current) return;
    if (!session) {
      navigate(loginPath);
      return;
    }
    if (!online) {
      setError(t("You are offline. Booking requests are not saved or queued. Reconnect before booking."));
      setConfirming(false);
      return;
    }
    submitting.current = true;
    const whatsappWindow = !own ? window.open("about:blank", "_blank") : null;
    if (whatsappWindow) whatsappWindow.opener = null;
    setBusy(true);
    setError("");
    try {
      const saved = await request("/appointments", {
        method: "POST",
        body: {
          professional,
          service,
          startsAt: time,
          acceptPolicy: true,
          policyVersion: business.policyVersion,
          ...(own
            ? bookingMode === "phone"
              ? { guestCustomer: {
                  name: guestName,
                  phone: normalizeInternationalPhone(guestPhone),
                  whatsappNumber: guestWhatsApp ? normalizeInternationalPhone(guestWhatsApp) : "",
                } }
              : { customer }
            : {}),
          notes: new FormData(formRef.current).get("notes"),
        },
      });
      setCreated(saved);
      setConfirming(false);
      if (whatsappWindow && business.whatsappNumber) {
        const name = own ? guestName || "Customer" : session.user.name;
        const text = `Hello, I would like to book an appointment.\n\nName: ${name}\nService: ${saved.serviceName}\nDate and time: ${dateTime(saved.startsAt)} (Africa/Maseru)\nService Price: ${money(saved.priceLisente)}\nBooking Reference: ${saved.reference}\nBooking Fee: ${money(saved.feeLisente)}\n\nPlease let me know how I can complete the booking fee payment.`;
        whatsappWindow.location.href = `https://wa.me/${String(business.whatsappNumber).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
      } else if (whatsappWindow) whatsappWindow.close();
    } catch (err) {
      whatsappWindow?.close();
      setError(err.message);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  return (
    <section className="container section narrow">
      <p className="eyebrow">{t("YOUR NEXT VISIT")}</p>
      {embedded ? (
        <h2>{t("Choose your professional and service")}</h2>
      ) : (
        <h1>{t("Book a professional.")}</h1>
      )}
      <p>
        Times use Africa/Maseru. Each professional sets their own services,
        booking fees and policies. Payment is arranged externally and verified
        only by that professional.
      </p>
      {loading ? (
        <p>Loading session…</p>
      ) : session?.user.role === "admin" ? (
        <div className="notice">
          Platform admins do not create or manage private professional bookings.
        </div>
      ) : created ? (
        <div className="panel">
          <h2>{t("Booking request saved")}</h2>
          <p>
            Reference: <strong>{created.reference}</strong>
          </p>
          <p>
            {created.serviceName} · {dateTime(created.startsAt)} · {money(created.priceLisente)}
          </p>
          <p>
            Booking fee {money(created.feeLisente)} · Total {money(created.totalLisente)}
          </p>
          <p>{t("Appointment status:")} {t("Pending Confirmation")} · {t("Payment status:")} {t("Awaiting Verification")}.</p>
          <p>Payment is arranged outside this website; no payment is recorded until the professional enters the actual receipt. WhatsApp will not send the message or verify payment. The appointment is confirmed only after the professional independently verifies actual receipt.</p>
          {!own && business?.whatsappNumber && (
            <a
              className="button"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/${String(business.whatsappNumber).replace(/\D/g, "")}?text=${encodeURIComponent(`Hello, I would like to book an appointment.\n\nName: ${session.user.name}\nService: ${created.serviceName}\nDate and time: ${dateTime(created.startsAt)} (Africa/Maseru)\nService Price: ${money(created.priceLisente)}\nBooking Reference: ${created.reference}\nBooking Fee: ${money(created.feeLisente)}\n\nPlease let me know how I can complete the booking fee payment.`)}`}
            >
              {t("Continue on WhatsApp")}
            </a>
          )}
          <Link to={own ? "/professional/appointments" : "/account"}>
            View appointments
          </Link>
        </div>
      ) : (
        <form ref={formRef} className="panel form-grid" onSubmit={submit}>
          <Loading state={services} />
          {own ? (
            <p>{t("You are booking for your own business only.")}</p>
          ) : (
            <label>
              {t("Professional")}
              <select
                required
                value={professional}
                disabled={professionals.loading || Boolean(professionals.error)}
                aria-invalid={Boolean(fieldErrors.professional)}
                aria-describedby={fieldErrors.professional ? "booking-professional-error" : undefined}
                onChange={(e) => {
                  setProfessional(e.target.value);
                  setService("");
                  setTime("");
                  clearFieldError("professional");
                }}
              >
                <option value="">Select professional</option>
                {professionals.loading && <option value="" disabled>{t("Loading professionals…")}</option>}
                {professionals.data?.items.length === 0 && <option value="" disabled>{t("No verified professionals are published yet")}</option>}
                {professionals.data?.items.map((p) => (
                  <option key={p.professional} value={p.professional}>
                    {p.salonName}
                  </option>
                ))}
              </select>
              {professionals.error && <div><small className="field-error" role="alert">{t("Professional information is temporarily unavailable.")}</small> <button type="button" onClick={professionals.reload}>{t("Try again")}</button></div>}
              {fieldErrors.professional && <small id="booking-professional-error" className="field-error" role="alert">{fieldErrors.professional}</small>}
            </label>
          )}
          {own && <div className="form-grid">
            <label>{t("Booking for")}
              <select value={bookingMode} onChange={(e) => setBookingMode(e.target.value)}>
                <option value="phone">Customer calling by phone (no account needed)</option>
                <option value="registered">Registered customer</option>
              </select>
            </label>
            {bookingMode === "phone" && <>
              <label>{t("Customer name")}<input required minLength={2} maxLength={100} value={guestName} aria-invalid={Boolean(fieldErrors.guestName)} aria-describedby={fieldErrors.guestName ? "booking-guest-name-error" : undefined} onChange={e => { setGuestName(e.target.value); clearFieldError("guestName"); }} />{fieldErrors.guestName && <small id="booking-guest-name-error" className="field-error" role="alert">{t(fieldErrors.guestName)}</small>}</label>
              <label>Customer phone contact<input required minLength={5} maxLength={40} type="tel" inputMode="tel" placeholder="+266 …" value={guestPhone} aria-invalid={Boolean(fieldErrors.guestPhone)} aria-describedby={fieldErrors.guestPhone ? "booking-guest-phone-error" : undefined} onChange={e => { setGuestPhone(e.target.value); clearFieldError("guestPhone"); }} />{fieldErrors.guestPhone && <small id="booking-guest-phone-error" className="field-error" role="alert">{fieldErrors.guestPhone}</small>}</label>
              <label>Customer WhatsApp (optional)<input maxLength={40} type="tel" inputMode="tel" placeholder="+266 …" value={guestWhatsApp} aria-invalid={Boolean(fieldErrors.guestWhatsApp)} aria-describedby={fieldErrors.guestWhatsApp ? "booking-guest-whatsapp-error" : undefined} onChange={e => { setGuestWhatsApp(e.target.value); clearFieldError("guestWhatsApp"); }} />{fieldErrors.guestWhatsApp && <small id="booking-guest-whatsapp-error" className="field-error" role="alert">{fieldErrors.guestWhatsApp}</small>}</label>
            </>}
          </div>}
          {own && bookingMode === "registered" && (
            <label>
              Customer
              <select
                required
                value={customer}
                aria-invalid={Boolean(fieldErrors.customer)}
                aria-describedby={fieldErrors.customer ? "booking-customer-error" : undefined}
                onChange={(e) => { setCustomer(e.target.value); clearFieldError("customer"); }}
              >
                <option value="">Select your customer</option>
                {customers.data?.items.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fieldErrors.customer && <small id="booking-customer-error" className="field-error" role="alert">{fieldErrors.customer}</small>}
            </label>
          )}
          <label>
            {t("Service")}
            <select
              required
              disabled={!professional}
              value={service}
              aria-invalid={Boolean(fieldErrors.service)}
              aria-describedby={fieldErrors.service ? "booking-service-error" : undefined}
              onChange={(e) => {
                setService(e.target.value);
                setTime("");
                clearFieldError("service");
              }}
            >
              <option value="">Select service</option>
              {services.data?.items
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} · {s.durationMinutes} min · {money(s.priceLisente)}
                  </option>
                ))}
            </select>
            {fieldErrors.service && <small id="booking-service-error" className="field-error" role="alert">{fieldErrors.service}</small>}
          </label>
          <label>
            {t("Date")}
            <input
              type="date"
              required
              min={todayInMaseru()}
              value={day}
              aria-invalid={Boolean(fieldErrors.day)}
              aria-describedby={fieldErrors.day ? "booking-date-error" : undefined}
              onChange={(e) => {
                setDay(e.target.value);
                setTime("");
                clearFieldError("day");
              }}
            />
            {fieldErrors.day && <small id="booking-date-error" className="field-error" role="alert">{fieldErrors.day}</small>}
          </label>
          <label>
            {t("Available time")}
            <select
              required
              value={time}
              aria-invalid={Boolean(fieldErrors.time)}
              aria-describedby={fieldErrors.time ? "booking-time-error" : undefined}
              onChange={(e) => setTime(e.target.value)}
            >
              <option value="">Select time</option>
              {slots.data?.slots?.map((value) => (
                <option key={value} value={value}>
                  {dateTime(value)}
                </option>
              ))}
            </select>
            {fieldErrors.time && <small id="booking-time-error" className="field-error" role="alert">{fieldErrors.time}</small>}
          </label>
          <Feedback error={slots.error || profile.error} />
          {professional && !business?.whatsappNumber && !profile.loading && (
            <p className="error" role="alert">
              This professional must add a valid WhatsApp number before online booking requests are available.
            </p>
          )}
          {day && service && slots.data?.slots?.length === 0 && (
            <p>{t("No available times for this professional.")}</p>
          )}
          <label>
            {t("Notes (optional)")}
            <textarea name="notes" maxLength={1000} />
          </label>
          {business && (
            <div className="policy">
              <p>
                {t("Booking fee")}:{" "}
                <strong>{money(business.bookingFeeLisente)}</strong> ·{" "}
                {business.feeDeducted
                  ? "deducted from service price"
                  : "charged separately"}
              </p>
              {selected && (
                <p>
                  Total{" "}
                  {money(
                    selected.priceLisente +
                      (business.feeDeducted ? 0 : business.bookingFeeLisente),
                  )}
                </p>
              )}
              <p>{business.policyText}</p>
              <p>
                {t("Policy version")} {business.policyVersion} · {t("Hold")}{" "}
                {business.holdMinutes} minutes
              </p>
              <label className="checkbox">
                <input type="checkbox" required aria-invalid={Boolean(fieldErrors.policy)} aria-describedby={fieldErrors.policy ? "booking-policy-error" : undefined} onChange={() => clearFieldError("policy")} />I accept this professional's
                booking fee and policy.
              </label>
              {fieldErrors.policy && <small id="booking-policy-error" className="field-error" role="alert">{fieldErrors.policy}</small>}
            </div>
          )}
          <Feedback error={error} />
          {!online && <p className="offline-action-note" role="status">{t("Booking requires a connection. Your request will not be queued offline.")}</p>}
          {!session && <p className="notice">Choose a professional, service, date and available time first. Then <Link to={loginPath}>log in</Link> or <Link to={registerPath}>register as a customer</Link> to submit the request; your selections will be kept.</p>}
          <button className="button" disabled={!online || busy || !time || !business || !business.whatsappNumber}>
            {t("Request Book")}
          </button>
        </form>
      )}
      {confirming && !created && (
        <div className="modal-backdrop">
          <section
            className="panel booking-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-confirmation-title"
          >
            <h2 id="booking-confirmation-title">{t("Are you sure you want to book?")}</h2>
            <dl>
              <dt>Professional</dt><dd>{business?.salonName || session?.user.name}</dd>
              <dt>Service</dt><dd>{selected?.name || "—"}</dd>
              <dt>Appointment</dt><dd>{time ? dateTime(time) : "—"}</dd>
              <dt>Service price</dt><dd>{selected ? money(selected.priceLisente) : "—"}</dd>
              <dt>Booking fee</dt><dd>{business ? money(business.bookingFeeLisente) : "—"}</dd>
            </dl>
            <p>{t("Confirming creates a pending request. Payment is arranged separately and is never confirmed by WhatsApp.")}</p>
            <div className="record-actions">
              <button type="button" disabled={busy} onClick={() => setConfirming(false)}>{t("Cancel")}</button>
              <button type="button" className="button" disabled={busy} onClick={confirmBooking}>
                {t(busy ? "Saving request…" : "Confirm")}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
const statuses = {
  awaiting_payment: "Awaiting Payment",
  unpaid: "Awaiting Payment",
  pending_confirmation: "Pending Confirmation",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  awaiting_verification: "Awaiting Verification",
  paid: "Paid",
  expired: "Expired",
  rejected: "Rejected",
};
export function Badge({ value }) {
  return (
    <span className={`badge status-${value}`}>{statuses[value] || value}</span>
  );
}
export function Collection({
  endpoint,
  children,
  statusOptions,
  initialStatus = "",
  columns,
  caption = "Records",
}) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(initialStatus);
  const state = useData(
    `${endpoint}?page=${page}&search=${encodeURIComponent(search)}${status ? "&status=" + status : ""}`,
  );
  return (
    <>
      <div className="toolbar">
        <label>
          Search
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search records"
          />
        </label>
        {statusOptions && (
          <label>
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {statusOptions.map((v) => (
                <option key={v} value={v}>
                  {statuses[v] || v}
                </option>
              ))}
            </select>
          </label>
        )}
        <button onClick={state.reload}>Refresh</button>
      </div>
      <Loading state={state} />
      {state.data?.items.length === 0 && <p>No records found.</p>}
      {columns && state.data?.items.length > 0 ? (
        <DataTable
          caption={caption}
          columns={columns}
          items={state.data.items}
        />
      ) : (
        state.data?.items.map((item) => (
          <div className="record panel" key={item._id}>
            {children(item, state.reload)}
          </div>
        ))
      )}
      {state.data && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} · {state.data.total} records
          </span>
          <button
            disabled={page * state.data.limit >= state.data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
export function Appointments({ initialStatus = "", pending = false }) {
  const { session } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [reschedule, setReschedule] = useState({});
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  async function act(item, action, reload, startsAt) {
    try {
      setError("");
      await request(`/appointments/${item._id}/action`, {
        method: "POST",
        body: {
          action,
          ...(startsAt
            ? { startsAt: new Date(startsAt + "+02:00").toISOString() }
            : {}),
        },
      });
      setMessage("Appointment updated.");
      reload();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <>
      <div className="toolbar">
        <Link
          className="button"
          to={
            session.user.role === "customer"
              ? "/account/book"
              : "/professional/book"
          }
        >
          New booking
        </Link>
      </div>
      <Feedback error={error} message={message} />
      <Collection
        endpoint="/appointments"
        initialStatus={pending ? "pending_confirmation" : initialStatus}
        statusOptions={[
          "awaiting_payment",
          "pending_confirmation",
          "confirmed",
          "in_progress",
          "completed",
          "cancelled",
          "no_show",
        ]}
      >
        {(item, reload) => (
          <>
            <div className="record-heading">
              <h3>{item.reference}</h3>
              <Badge value={item.status} />
            </div>
            <p>
              {item.serviceName} · {dateTime(item.startsAt)} ·{" "}
              {item.durationMinutes} min
            </p>
            <p>
              Customer: {item.customer?.name || item.guestCustomer?.name || "—"} · Professional:{" "}
              {item.professional?.name || "—"}
            </p>
            {session.user.role === "professional" && (
              <p>
                Customer contact: {item.customer?.phone || item.guestCustomer?.phone || "Phone not provided"}
                {item.customer?.email ? ` · ${item.customer.email}` : ""}
              </p>
            )}
            <p>
              Total {money(item.totalLisente)} · Booking fee{" "}
              {money(item.feeLisente)}
            </p>
            <p>
              Payment status: <Badge value={item.paymentStatus || "awaiting_payment"} />
              {item.paymentAmountLisente !== undefined && ` · ${money(item.paymentAmountLisente)}`}
            </p>
            {item.createdAt && <p>Request received {dateTime(item.createdAt)}</p>}
            {item.holdExpiresAt &&
              !["cancelled", "completed"].includes(item.status) && (
                <p>Hold expires {dateTime(item.holdExpiresAt)}</p>
              )}
            <details>
              <summary>
                Accepted booking policy (version {item.policyVersion})
              </summary>
              <p>{item.policyText}</p>
              <p>Accepted {dateTime(item.policyAcceptedAt)}</p>
            </details>
            {!["cancelled", "completed", "no_show"].includes(item.status) && (
              <div className="record-actions">
                <button onClick={() => act(item, "cancel", reload)}>
                  Cancel appointment
                </button>
                <label>
                  New salon-local date/time
                  <input
                    type="datetime-local"
                    value={reschedule[item._id] || ""}
                    onChange={(e) =>
                      setReschedule({
                        ...reschedule,
                        [item._id]: e.target.value,
                      })
                    }
                  />
                </label>
                <button
                  disabled={!reschedule[item._id]}
                  onClick={() =>
                    act(item, "reschedule", reload, reschedule[item._id])
                  }
                >
                  Reschedule
                </button>
                {session.user.role !== "customer" &&
                  item.status === "confirmed" && (
                    <>
                      {now >= +new Date(item.startsAt) &&
                        now < +new Date(item.endsAt) && (
                          <button onClick={() => act(item, "start", reload)}>
                            Start appointment
                          </button>
                        )}
                      {now >= +new Date(item.endsAt) && (
                        <>
                          <button onClick={() => act(item, "complete", reload)}>
                            Complete
                          </button>
                          <button onClick={() => act(item, "no_show", reload)}>
                            No-show
                          </button>
                        </>
                      )}
                    </>
                  )}
                {session.user.role !== "customer" &&
                  item.status === "in_progress" && (
                    <button onClick={() => act(item, "complete", reload)}>
                      Complete appointment
                    </button>
                  )}
              </div>
            )}
            <WhatsApp appointment={item} />
          </>
        )}
      </Collection>
    </>
  );
}
export function PendingConfirmations() {
  const appointments = useData("/appointments?status=pending_confirmation&limit=100");
  const payments = useData("/payments?status=awaiting_verification&limit=100");
  const history = useData("/appointments?status=confirmed&limit=20");
  const [selected, setSelected] = useState(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const awaiting = payments.data?.items || [];
  async function confirm() {
    if (!selected || !verified || busy) return;
    setBusy(true);
    setError("");
    try {
      await request(`/payments/${selected.payment._id}/review`, {
        method: "POST",
        body: {
          action: "verify",
          note: "Professional independently confirmed actual booking-fee receipt.",
        },
      });
      setSelected(null);
      setVerified(false);
      setMessage("Payment verified and appointment confirmed. Customer notification is queued according to email settings.");
      appointments.reload();
      payments.reload();
      history.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p>Requests remain pending until you have actually received and independently checked the booking fee. WhatsApp messages and receipt screenshots are not proof of funds.</p>
      <Feedback error={error} message={message} />
      <Loading state={appointments} />
      <Loading state={payments} />
      {appointments.data?.items.length === 0 && <p>No pending booking confirmations.</p>}
      {appointments.data?.items.map((item) => {
        const payment = awaiting.find((entry) => entry.kind === "booking_fee" && String(entry.appointment?._id) === String(item._id));
        return (
          <article className="record panel" key={item._id}>
            <div className="record-heading">
              <h2>{item.reference}</h2>
              <Badge value={item.status} />
            </div>
            <p><strong>{item.customer?.name || item.guestCustomer?.name || "Customer"}</strong> · {item.serviceName}</p>
            <p>{dateTime(item.startsAt)} · Service {money(item.priceLisente)} · Booking fee {money(item.feeLisente)}</p>
            <p>Payment status: <Badge value={item.paymentStatus || "awaiting_payment"} /> · Appointment status: <Badge value={item.status} /></p>
            <p>Customer contact: {item.customer?.phone || item.guestCustomer?.phone || "Phone not provided"}{item.customer?.email ? ` · ${item.customer.email}` : ""}</p>
            <p>Request received {dateTime(item.createdAt)}</p>
            {payment ? (
              <>
                <p>Recorded receipt: {payment.method} · {money(payment.amountLisente)} · {payment.reference}</p>
                <button className="button" onClick={() => { setSelected({ appointment: item, payment }); setVerified(false); }}>
                  Confirm Payment &amp; Appointment
                </button>
              </>
            ) : (
              <p>No payment receipt is recorded. After receiving the fee, record the actual method and receipt reference in Payments; this request cannot be confirmed yet.</p>
            )}
          </article>
        );
      })}
      <section className="panel dashboard-section">
        <h2>Recent confirmation history</h2>
        {history.data?.items.length ? history.data.items.slice(0, 10).map((item) => (
          <p key={item._id}><strong>{item.reference}</strong> · {item.serviceName} · {dateTime(item.startsAt)} · {item.customer?.name || "Customer"} · Confirmed</p>
        )) : <p>No confirmed appointments yet.</p>}
      </section>
      {selected && (
        <div className="modal-backdrop">
          <section className="panel booking-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-confirmation-title">
            <h2 id="payment-confirmation-title">Confirm payment and appointment</h2>
            <p>Booking {selected.appointment.reference} · {selected.appointment.customer?.name || selected.appointment.guestCustomer?.name || "Customer"}</p>
            <p>{selected.appointment.serviceName} · {dateTime(selected.appointment.startsAt)}</p>
            <p>Recorded booking fee: <strong>{money(selected.payment.amountLisente)}</strong> via {selected.payment.method} · Receipt {selected.payment.reference}</p>
            <label className="checkbox"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />I independently verified that this booking fee was actually received.</label>
            <p>Confirming updates the payment and appointment atomically and notifies the customer. Do not rely on WhatsApp claims or screenshots.</p>
            <div className="record-actions">
              <button type="button" disabled={busy} onClick={() => setSelected(null)}>Cancel</button>
              <button type="button" className="button" disabled={busy || !verified} onClick={confirm}>{busy ? "Confirming…" : "Confirm Payment & Appointment"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
const fields = {
  services: [
    ["name", "Service name", "text"],
    ["description", "Description", "textarea"],
    ["durationMinutes", "Duration (minutes, multiples of 15)", "number"],
    ["priceLisente", "Price (integer lisente; 100 = M1)", "number"],
    ["imageUrl", "Image URL (HTTPS, optional)", "url"],
    ["active", "Active", "checkbox"],
    ["verified", "Owner-verified for public booking", "checkbox"],
  ],
  customers: [
    ["name", "Name", "text"],
    ["email", "Email", "email"],
    ["password", "Initial password (12+ characters)", "password"],
  ],
  expenses: [
    ["description", "Description", "text"],
    ["category", "Category", "category"],
    ["amountLisente", "Amount (integer lisente)", "number"],
    ["incurredAt", "Date and time (Africa/Maseru)", "datetime-local"],
  ],
};
const initialDraft = {
  services: {
    name: "",
    description: "",
    durationMinutes: 60,
    priceLisente: 0,
    imageUrl: "",
    active: true,
    verified: false,
  },
  customers: { name: "", email: "", password: "" },
  expenses: {
    description: "",
    category: "products",
    amountLisente: 0,
    incurredAt: "",
  },
};
function ServiceImageEditor({ service, onUpdated }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  async function save() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const result = await request(`/professional/services/${service._id}/image`, {
        method: "PUT",
        rawBody: file,
        headers: { "Content-Type": file.type },
      });
      setFile(null);
      setPreview("");
      onUpdated(result.imageUrl, true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await request(`/professional/services/${service._id}/image`, { method: "DELETE" });
      setFile(null);
      setPreview("");
      onUpdated("", false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="media-editor service-media-editor">
      <h3>Service image</h3>
      <p>PNG, JPEG or WebP, up to 5 MB.</p>
      {(preview || service.imageUrl) && (
        <img
          className="media-preview service-image-preview"
          src={preview || mediaUrl(service.imageUrl)}
          alt={`${service.name} preview`}
        />
      )}
      <label>
        Upload or replace image
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => {
            const selected = event.target.files?.[0] || null;
            setError("");
            if (selected && !["image/png", "image/jpeg", "image/webp"].includes(selected.type)) {
              setError("Choose a PNG, JPEG or WebP image.");
              setFile(null);
              setPreview("");
            } else if (selected && selected.size > 5 * 1024 * 1024) {
              setError("Image must be at most 5 MB.");
              setFile(null);
              setPreview("");
            } else {
              setFile(selected);
              setPreview(selected ? URL.createObjectURL(selected) : "");
            }
            event.target.value = "";
          }}
        />
      </label>
      <Feedback error={error} />
      <div className="media-editor-actions">
        <button type="button" className="button" disabled={!file || busy} onClick={save}>
          {busy ? "Saving…" : "Save service image"}
        </button>
        {service.image && <button type="button" disabled={busy} onClick={remove}>Remove image</button>}
      </div>
    </section>
  );
}
export function Manage({ kind }) {
  const [draft, setDraft] = useState(initialDraft[kind]),
    [editing, setEditing] = useState(null),
    [editingItem, setEditingItem] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [formOpen, setFormOpen] = useState(false);
  const modalKind = kind === "services";
  function closeForm() {
    if (busy) return;
    setFormOpen(false);
    setEditing(null);
    setEditingItem(null);
    setDraft(initialDraft[kind]);
    setError("");
  }
  function openForm(item = null) {
    setDraft(item ? Object.fromEntries(fields[kind].map(([key]) => [key, item[key] ?? initialDraft[kind][key]])) : initialDraft[kind]);
    setEditing(item?._id || null);
    setEditingItem(item);
    setError("");
    setMessage("");
    setFormOpen(true);
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...draft };
      if (kind === "expenses")
        body.incurredAt = new Date(body.incurredAt + "+02:00").toISOString();
      await request(`/${kind}${editing ? "/" + editing : ""}`, {
        method: editing ? "PATCH" : "POST",
        body,
      });
      setMessage("Your record was saved.");
      setError("");
      setDraft(initialDraft[kind]);
      setEditing(null);
      setEditingItem(null);
      setFormOpen(false);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {modalKind && <style>{`
        .service-manage-toolbar { display:flex; justify-content:flex-end; margin-bottom:16px; }
        .service-modal-backdrop { position:fixed; inset:0; z-index:1000; background:rgba(20,17,32,.58); display:flex; align-items:center; justify-content:center; padding:20px; }
        .service-modal-dialog { background:#fff; color:#272638; width:min(780px,100%); max-height:calc(100vh - 40px); overflow-y:auto; border:1px solid #ded9e9; border-radius:12px; padding:24px; box-shadow:0 24px 65px #1c183d33; font-family:Arial,Helvetica,sans-serif; }
        .service-modal-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:18px; }
        .service-modal-heading h2 { margin:0; }
        .service-modal-heading button { border:0; background:transparent; font-size:20px; cursor:pointer; }
        .service-modal-form { padding:0; border:0; box-shadow:none; }
        .service-modal-form button.button { background:#6745a6; color:white; }
        @media(max-width:640px) { .service-modal-dialog { padding:16px; } .service-modal-form { grid-template-columns:1fr; } }
      `}</style>}
      {modalKind && (
        <div className="service-manage-toolbar">
          <button className="button" type="button" onClick={() => openForm()}>
            + Add {kind === "services" ? "service" : "customer"}
          </button>
        </div>
      )}
      {!modalKind && <Feedback error={error} message={message} />}
      {modalKind && message && <Feedback message={message} />}
      {kind !== "customers" && (!modalKind || formOpen) && (
        <div className={modalKind ? "service-modal-backdrop" : "service-standard-form"} onMouseDown={(e) => {
          if (modalKind && e.target === e.currentTarget) closeForm();
        }}>
          <div className={modalKind ? "service-modal-dialog" : ""} role={modalKind ? "dialog" : undefined} aria-modal={modalKind ? "true" : undefined} aria-labelledby={modalKind ? "manage-modal-title" : undefined} onKeyDown={(e) => {
            if (modalKind && e.key === "Escape") { e.stopPropagation(); closeForm(); }
          }}>
            {modalKind && <div className="service-modal-heading">
              <h2 id="manage-modal-title">{editing ? "Edit" : "Add"} {kind === "services" ? "service" : "customer"}</h2>
              <button type="button" aria-label="Close form" onClick={closeForm} disabled={busy}>✕</button>
            </div>}
            {modalKind && <Feedback error={error} />}
            {kind === "services" && editingItem && (
              <ServiceImageEditor
                service={editingItem}
                onUpdated={(imageUrl, image) => {
                  setEditingItem({ ...editingItem, imageUrl, image });
                  setVersion((v) => v + 1);
                }}
              />
            )}
            <form className={modalKind ? "form-grid service-modal-form" : "panel form-grid"} onSubmit={submit}>
        {!modalKind && <h2>{editing ? "Edit" : "Add"} {kind.replace(/s$/, "")}</h2>}
        {fields[kind].map(([key, label, type]) => (
          <label key={key} className={type === "checkbox" ? "checkbox" : ""}>
            {label}
            {type === "textarea" ? (
              <textarea
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            ) : type === "category" ? (
              <select
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              >
                {[
                  "products",
                  "equipment",
                  "rent",
                  "electricity",
                  "water",
                  "other",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            ) : (
              <input
                type={type}
                required={
                  type !== "checkbox" &&
                  !["description", "imageUrl"].includes(key)
                }
                min={type === "number" ? 0 : undefined}
                minLength={type === "password" ? 12 : undefined}
                checked={type === "checkbox" ? draft[key] : undefined}
                value={type === "checkbox" ? undefined : draft[key]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [key]:
                      type === "checkbox"
                        ? e.target.checked
                        : type === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                  })
                }
              />
            )}
          </label>
        ))}
        <button className="button" disabled={busy}>
          Save record
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(initialDraft[kind]);
              setEditing(null);
              setEditingItem(null);
            }}
          >
            Cancel editing
          </button>
        )}
      {modalKind && <button type="button" onClick={closeForm} disabled={busy}>Cancel</button>}
      </form>
          </div>
        </div>
      )}
      {kind === "customers" && (
        <p className="notice">
          Customers who book online appear in your business records. To arrange a booking for someone calling by phone, use New booking from Appointments.
        </p>
      )}
      <Collection
        key={version}
        endpoint={"/" + kind}
        caption={kind[0].toUpperCase() + kind.slice(1)}
        columns={[
          {
            label: kind === "expenses" ? "Expense" : "Name",
            render: (item) => <h3>{item.name || item.description}</h3>,
          },
          ...(kind === "services"
            ? [
                {
                  label: "Duration",
                  render: (item) => item.durationMinutes + " min",
                },
                { label: "Price", render: (item) => money(item.priceLisente) },
                {
                  label: "Status",
                  render: (item) => (
                    <span className="badge">
                      {item.active ? "Active" : "Inactive"} · {item.verified ? "Verified for public" : "Needs owner verification"}
                    </span>
                  ),
                },
                {
                  label: "Action",
                  render: (item) => (
                    <button
                      onClick={() => {
                        openForm(item);
                      }}
                    >
                      Edit record
                    </button>
                  ),
                },
              ]
            : kind === "expenses"
              ? [
                  { label: "Category", render: (item) => item.category },
                  {
                    label: "Amount",
                    render: (item) => money(item.amountLisente),
                  },
                  {
                    label: "Date",
                    render: (item) => dateTime(item.incurredAt),
                  },
                ]
              : [
                  { label: "Email", render: (item) => item.email },
                  { label: "Phone", render: (item) => item.phone || "—" },
                ]),
        ]}
      >
        {(item) => (
          <>
            <h3>{item.name || item.description}</h3>
            {kind === "services" ? (
              <p>
                {item.durationMinutes} min · {money(item.priceLisente)} ·{" "}
                {item.active ? "Active" : "Inactive"} · {item.verified ? "Verified for public" : "Needs owner verification"}
              </p>
            ) : kind === "expenses" ? (
              <p>
                {item.category} · {money(item.amountLisente)} ·{" "}
                {dateTime(item.incurredAt)}
              </p>
            ) : (
              <p>{item.email}</p>
            )}
            {kind === "services" && (
              <button
                onClick={() => {
                  setDraft(
                    Object.fromEntries(
                      fields.services.map(([key]) => [key, item[key]]),
                    ),
                  );
                  setEditing(item._id);
                }}
              >
                Edit record
              </button>
            )}
          </>
        )}
      </Collection>
    </>
  );
}
export function Payments({ pending = false }) {
  const { session } = useAuth();
  const online = useOnline();
  const appointments = useData("/appointments?limit=100");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [version, setVersion] = useState(0);
  const canRecord = session.user.role === "professional",
    canVerify = session.user.role === "professional";
  async function record(e) {
    e.preventDefault();
    if (!online) {
      setError("Payment recording requires an internet connection and is never queued offline.");
      return;
    }
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    body.amountLisente = Number(body.amountLisente);
    try {
      await request("/payments", { method: "POST", body });
      setMessage("Payment recorded awaiting independent verification.");
      setError("");
      setVersion((v) => v + 1);
      form.reset();
    } catch (err) {
      setError(err.message);
    }
  }
  async function review(id, action, note, reload) {
    if (!online) {
      setError("Payment verification requires an internet connection and is never queued offline.");
      return;
    }
    try {
      await request(`/payments/${id}/review`, {
        method: "POST",
        body: { action, note },
      });
      setMessage("Review recorded.");
      setError("");
      reload();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <>
      <p>
        {canRecord
          ? "Record externally arranged payments for your own business only. Receipt evidence is not proof of funds; verify independently before confirmation."
          : "Your professional records and independently verifies payments. A receipt or WhatsApp message alone does not confirm payment."}
      </p>
      <Feedback error={error} message={message} />
      {!online && <p className="offline-action-note" role="status">Payment recording and verification are unavailable offline. Nothing will be queued.</p>}
      {canRecord && !pending && (
        <form className="panel form-grid" onSubmit={record}>
          <h2>Record manual payment</h2>
          <label>
            Appointment
            <select name="appointment" required>
              <option value="">Choose booking</option>
              {appointments.data?.items
                .filter((a) => !["cancelled", "no_show"].includes(a.status))
                .map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.reference} · {a.serviceName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Purpose
            <select name="kind">
              <option value="booking_fee">Booking fee</option>
              <option value="balance">Remaining service balance</option>
            </select>
          </label>
          <label>
            Amount (integer lisente)
            <input
              type="number"
              name="amountLisente"
              required
              min="1"
              step="1"
            />
          </label>
          <label>
            Method
            <select name="method">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="mobile_money_manual">Manual mobile money</option>
              <option value="mobile_money_agent">Mobile money agent</option>
            </select>
          </label>
          <label>
            Unique receipt / transaction reference
            <input name="reference" required minLength={3} maxLength={100} />
          </label>
          <label>
            Evidence URL (optional, HTTPS)
            <input type="url" name="evidenceUrl" />
          </label>
          <button className="button" disabled={!online}>Record awaiting verification</button>
        </form>
      )}
      <Collection
        key={version}
        endpoint="/payments"
        initialStatus={pending ? "awaiting_verification" : ""}
        statusOptions={[
          "awaiting_verification",
          "paid",
          "rejected",
          "expired",
          "cancelled",
        ]}
      >
        {(item, reload) => (
          <PaymentRow
            item={item}
            reload={reload}
            canVerify={canVerify}
            review={review}
            pending={pending}
            online={online}
          />
        )}
      </Collection>
    </>
  );
}
function PaymentRow({ item, reload, canVerify, review, pending, online }) {
  const [note, setNote] = useState("");
  if (pending && item.status !== "awaiting_verification") return null;
  return (
    <>
      <div className="record-heading">
        <h3>{item.reference}</h3>
        <Badge value={item.status} />
      </div>
      <p>
        {item.appointment?.reference} ·{" "}
        {item.kind === "booking_fee" ? "Booking fee" : "Service balance"} ·{" "}
        {money(item.amountLisente)} · {item.method}
      </p>
      {item.verifiedAt && (
        <p>
          Verified by {item.verifiedBy?.name} · {dateTime(item.verifiedAt)}
        </p>
      )}
      {item.reviewNote && <p>Review: {item.reviewNote}</p>}
      {item.evidenceUrl && (
        <a
          className="underlink"
          target="_blank"
          rel="noreferrer"
          href={item.evidenceUrl}
        >
          View evidence (not proof of funds)
        </a>
      )}
      {canVerify && item.status === "awaiting_verification" && (
        <div className="form-grid">
          <label>
            Review notes
            <input
              value={note}
              minLength={3}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="record-actions">
            <button
              disabled={!online || note.trim().length < 3}
              onClick={() => review(item._id, "verify", note, reload)}
            >
              I independently verified received funds
            </button>
            <button
              disabled={!online || note.trim().length < 3}
              onClick={() => review(item._id, "reject", note, reload)}
            >
              Reject
            </button>
            <button
              disabled={!online || note.trim().length < 3}
              onClick={() => review(item._id, "request_info", note, reload)}
            >
              Request information
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export function Reports() {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const state = useData(
    `/reports?${from ? "from=" + from : ""}${to ? "&to=" + to : ""}`,
  );
  const data = state.data;
  function range(period) {
    const local = new Date(Date.now() + 7200000);
    const end = local.toISOString().slice(0, 10);
    if (period === "all") {
      setFrom("");
      setTo("");
      return;
    }
    if (period === "week") local.setUTCDate(local.getUTCDate() - 6);
    if (period === "month") local.setUTCDate(1);
    setFrom(local.toISOString().slice(0, 10));
    setTo(end);
  }
  function exportReport() {
    const rows = [
      ["Metric", "Lisente"],
      ["Received income", data.receivedLisente],
      ["Booking fee income", data.bookingFeeIncomeLisente],
      ["Balance payment income", data.balanceIncomeLisente],
      ["Expenses", data.expenseLisente],
      ["Profit/loss", data.profitLisente],
      ["Booked value", data.bookedValueLisente],
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((v) => v.join(",")).join("\n")], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "salon-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="toolbar">
        <button onClick={() => range("today")}>Today</button>
        <button onClick={() => range("week")}>Last 7 days</button>
        <button onClick={() => range("month")}>This month</button>
        <button onClick={() => range("all")}>All time</button>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <Loading state={state} />
      {data && (
        <>
          <p>{data.basis}</p>
          <div className="stats">
            {[
              ["Received income", data.receivedLisente],
              ["Booking fee income", data.bookingFeeIncomeLisente],
              ["Balance payment income", data.balanceIncomeLisente],
              ["Expenses", data.expenseLisente],
              ["Profit / loss", data.profitLisente],
              ["Booked value (not income)", data.bookedValueLisente],
            ].map(([label, value]) => (
              <div className="panel" key={label}>
                <p>{label}</p>
                <h2>{money(value)}</h2>
              </div>
            ))}
          </div>
          <button onClick={exportReport}>Export summary CSV</button>
          <div className="panel chart-panel">
            <h2>Received income by local day (lisente)</h2>
            {data.daily.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.daily}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(v) => money(v)} />
                  <Bar dataKey="receivedLisente" fill="#6d42a1" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p>No verified income in this range.</p>
            )}
          </div>
          <div className="panel">
            <h2>Service popularity</h2>
            {data.popularity.map((v) => (
              <p key={v.name}>
                {v.name}: {v.count} bookings
              </p>
            ))}
          </div>
          <div className="panel">
            <h2>Expense categories</h2>
            {data.expenseCategories?.map((v) => (
              <p key={v.category}>
                {v.category}: {money(v.amountLisente)}
              </p>
            ))}
            <h2>Outstanding balances</h2>
            {data.outstanding.map((v) => (
              <p key={v.reference}>
                {v.reference}: {money(v.outstandingLisente)}
              </p>
            ))}
          </div>
        </>
      )}
    </>
  );
}
export function SettingsPage() {
  const state = useData("/professional/settings");
  return (
    <>
      <Loading state={state} />
      {state.data && (
        <>
          <ProfilePhotoEditor initial={state.data} onUpdated={state.reload} />
          <SettingsForm key={state.data.updatedAt} initial={state.data} />
        </>
      )}
    </>
  );
}
function ProfilePhotoEditor({ initial, onUpdated }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("/professional/profile/photo", {
        method: "PUT",
        rawBody: file,
        headers: { "Content-Type": file.type },
      });
      setFile(null);
      setPreview("");
      setMessage("Business profile photo updated.");
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("/professional/profile/photo", { method: "DELETE" });
      setFile(null);
      setPreview("");
      setMessage("Business profile photo removed.");
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel media-editor">
      <h2>Business profile photo</h2>
      <p>PNG, JPEG or WebP, up to 5 MB. The image is resized and stored securely.</p>
      {(preview || initial.photoUrl) && (
        <img
          className="media-preview profile-photo-preview"
          src={preview || mediaUrl(initial.photoUrl)}
          alt="Business profile preview"
        />
      )}
      <label>
        Choose profile photo
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => {
            const selected = event.target.files?.[0] || null;
            setError("");
            if (selected && !["image/png", "image/jpeg", "image/webp"].includes(selected.type)) {
              setError("Choose a PNG, JPEG or WebP image.");
              setFile(null);
              setPreview("");
            } else if (selected && selected.size > 5 * 1024 * 1024) {
              setError("Image must be at most 5 MB.");
              setFile(null);
              setPreview("");
            } else {
              setFile(selected);
              setPreview(selected ? URL.createObjectURL(selected) : "");
            }
            event.target.value = "";
          }}
        />
      </label>
      <Feedback error={error} message={message} />
      <div className="media-editor-actions">
        <button className="button" type="button" disabled={!file || busy} onClick={upload}>
          {busy ? "Saving…" : initial.photoUrl ? "Replace photo" : "Upload photo"}
        </button>
        {initial.photoUrl && (
          <button type="button" disabled={busy} onClick={remove}>Remove photo</button>
        )}
      </div>
    </section>
  );
}
function SettingsForm({ initial }) {
  const { reloadBusiness } = useAuth();
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const whatsappNumber = normalizeInternationalPhone(
      form.get("whatsappNumber"),
    );
    if (!whatsappNumber) {
      setError("Enter a valid international WhatsApp number, including country code.");
      setMessage("");
      return;
    }
    const phone = String(form.get("phone") || "").trim();
    if (phone && !normalizeInternationalPhone(phone)) {
      setError("Enter the business phone number in international format, including country code, or leave it blank.");
      setMessage("");
      return;
    }
    try {
      const body = {
        published: form.has("published"),
        salonName: form.get("salonName"),
        description: form.get("description"),
        demo: form.has("demo"),
        whatsappNumber,
        phone: phone ? normalizeInternationalPhone(phone) : "",
        email: form.get("email"),
        address: form.get("address"),
        openingHours: Object.fromEntries(
          Array.from({ length: 7 }, (_, day) => day)
            .filter((day) => form.has(`open_${day}`))
            .map((day) => [
              String(day),
              `${form.get(`start_${day}`)}-${form.get(`end_${day}`)}`,
            ]),
        ),
        closedDates: form
          .get("closedDates")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        bookingFeeLisente: Number(form.get("bookingFeeLisente")),
        feeDeducted: form.has("feeDeducted"),
        holdMinutes: Number(form.get("holdMinutes")),
        policyText: form.get("policyText"),
        changeNoticeHours: Number(form.get("changeNoticeHours")),
      };
      await request("/professional/settings", { method: "PUT", body });
      await reloadBusiness();
      setError("");
      setMessage(
        "Settings saved. New bookings use the new policy version; existing snapshots are preserved.",
      );
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <form className="panel form-grid" onSubmit={submit}>
      <Feedback error={error} message={message} />
      <label className="checkbox">
        <input
          name="published"
          type="checkbox"
          defaultChecked={initial.published}
        />
        Publish my business profile and active services
      </label>
      {[
        ["salonName", "Business name"],
        ["description", "Description"],
        ["address", "Address"],
        ["phone", "Phone"],
        ["email", "Email"],
        ["whatsappNumber", "WhatsApp number (international format)"],
      ].map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            name={key}
            type={["whatsappNumber", "phone"].includes(key) ? "tel" : key === "email" ? "email" : "text"}
            inputMode={["whatsappNumber", "phone"].includes(key) ? "tel" : undefined}
            autoComplete={["whatsappNumber", "phone"].includes(key) ? "tel" : undefined}
            defaultValue={initial[key]}
            maxLength={key === "description" ? 2000 : 500}
            required={key === "whatsappNumber"}
            placeholder={key === "whatsappNumber" ? "+266 56903048" : undefined}
          />
        </label>
      ))}
      <fieldset className="hours-grid">
        <legend>Opening hours · Africa/Maseru</legend>
        {[
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ].map((day, index) => (
          <div className="hours-row" key={day}>
            <label className="checkbox">
              <input
                type="checkbox"
                name={`open_${index}`}
                defaultChecked={!!initial.openingHours[index]}
              />
              {day} open
            </label>
            <label>
              {day} opening time
              <input
                type="time"
                name={`start_${index}`}
                defaultValue={
                  initial.openingHours[index]?.split("-")[0] || "09:00"
                }
              />
            </label>
            <label>
              {day} closing time
              <input
                type="time"
                name={`end_${index}`}
                defaultValue={
                  initial.openingHours[index]?.split("-")[1] || "17:00"
                }
              />
            </label>
          </div>
        ))}
      </fieldset>
      <label>
        Closed dates (YYYY-MM-DD, comma-separated)
        <input
          name="closedDates"
          defaultValue={initial.closedDates.join(",")}
        />
      </label>
      {[
        ["bookingFeeLisente", "Booking fee (integer lisente)"],
        ["holdMinutes", "Booking hold duration (minutes)"],
        ["changeNoticeHours", "Customer change notice (hours)"],
      ].map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            type="number"
            name={key}
            required
            min={0}
            defaultValue={initial[key]}
          />
        </label>
      ))}
      <label className="checkbox">
        Booking fee is deducted from service price
        <input
          type="checkbox"
          name="feeDeducted"
          defaultChecked={initial.feeDeducted}
        />
      </label>
      <label className="checkbox">
        Clearly label business as demonstration data
        <input type="checkbox" name="demo" defaultChecked={initial.demo} />
      </label>
      <label>
        Booking and cancellation policy
        <textarea
          name="policyText"
          required
          minLength={20}
          maxLength={3000}
          rows={5}
          defaultValue={initial.policyText}
        />
      </label>
      <button className="button">Save business settings</button>
    </form>
  );
}
export function Profile() {
  const { session, setSession } = useAuth();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [fieldErrors, setFieldErrors] = useState({});
  async function save(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const whatsappNumber = String(form.get("whatsappNumber") || "").trim();
    const errors = {};
    if (name.length < 2 || name.length > 100 || !personNamePattern.test(name))
      errors.name = "Enter a valid name using letters, spaces, apostrophes, or hyphens.";
    if (phone && !normalizeInternationalPhone(phone))
      errors.phone = "Enter a valid international phone number, including country code, or leave blank.";
    if (whatsappNumber && !normalizeInternationalPhone(whatsappNumber))
      errors.whatsappNumber = "Enter a valid international WhatsApp number, including country code, or leave blank.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Please correct the highlighted profile details.");
      e.currentTarget.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    try {
      const result = await request("/profile", {
        method: "PATCH",
        body: {
          name,
          phone: phone ? normalizeInternationalPhone(phone) : "",
          whatsappNumber: whatsappNumber ? normalizeInternationalPhone(whatsappNumber) : "",
        },
      });
      setSession({ ...session, user: result.user });
      setMessage("Profile saved.");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  async function change(e) {
    e.preventDefault();
    try {
      await request("/profile/password", {
        method: "POST",
        body: Object.fromEntries(new FormData(e.currentTarget)),
      });
      acceptSession(null);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <>
      <Feedback error={error} message={message} />
      <form className="panel form-grid" noValidate onSubmit={save}>
        <h2>Your profile</h2>
        <p>{session.user.email}</p>
        <label>
          Name
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={session.user.name}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "profile-name-error" : undefined}
          />
          {fieldErrors.name && <small id="profile-name-error" className="field-error" role="alert">{fieldErrors.name}</small>}
        </label>
        <label>
          Phone
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} defaultValue={session.user.phone} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "profile-phone-error" : undefined} />
          {fieldErrors.phone && <small id="profile-phone-error" className="field-error" role="alert">{fieldErrors.phone}</small>}
        </label>
        {session.user.role === "customer" && <label>
          WhatsApp number (optional)
          <input name="whatsappNumber" type="tel" inputMode="tel" autoComplete="tel" placeholder="+266 56903048" maxLength={40} defaultValue={session.user.whatsappNumber || ""} aria-invalid={Boolean(fieldErrors.whatsappNumber)} aria-describedby={fieldErrors.whatsappNumber ? "profile-whatsapp-error" : "profile-whatsapp-help"} />
          <small>Leave blank to use email or phone contact instead. We never infer WhatsApp from your email.</small>
          {fieldErrors.whatsappNumber && <small id="profile-whatsapp-error" className="field-error" role="alert">{fieldErrors.whatsappNumber}</small>}
        </label>}
        <button className="button">Save profile</button>
      </form>
      <form className="panel form-grid" onSubmit={change}>
        <h2>Change password</h2>
        <label>
          Current password
          <input
            type="password"
            name="currentPassword"
            required
            autoComplete="current-password"
          />
        </label>
        <label>
          New password (12+ characters)
          <input
            type="password"
            name="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
        </label>
        <button>Change password and sign out all sessions</button>
      </form>
    </>
  );
}
export function NotificationHistory() {
  const [error, setError] = useState("");
  const { session } = useAuth();
  return (
    <>
      <Feedback error={error} />
      <Collection endpoint="/notifications">
        {(item, reload) => (
          <>
            <h3>{item.title}</h3>
            <Badge value={item.status} />
            <p>{item.message}</p>
            <p>
              Attempts: {item.attempts} · {item.lastError}
            </p>
            {session.user.role === "professional" &&
              item.status === "failed" && (
                <button
                  onClick={async () => {
                    try {
                      await request(`/notifications/${item._id}/retry`, {
                        method: "POST",
                      });
                      reload();
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                >
                  Retry failed delivery
                </button>
              )}
          </>
        )}
      </Collection>
    </>
  );
}
export function AuditHistory() {
  return (
    <Collection endpoint="/audit">
      {(item) => (
        <>
          <h3>{item.action}</h3>
          <p>
            {item.actor?.name} · {dateTime(item.createdAt)} · {item.entityId}
          </p>
          <p>{item.details}</p>
        </>
      )}
    </Collection>
  );
}
