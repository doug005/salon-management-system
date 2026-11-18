import { useEffect, useMemo, useRef, useState } from "react";
import { request, dateTime, money } from "./api.js";
import { useData } from "./state.jsx";
import { normalizeInternationalPhone } from "./phone.js";
import { useLanguage } from "./i18n.jsx";
import { useOnline } from "./offline.jsx";

const labels = {
  awaiting_payment: "Awaiting Payment", unpaid: "Awaiting Payment",
  pending_confirmation: "Pending Confirmation", confirmed: "Confirmed",
  in_progress: "In progress", completed: "Completed", cancelled: "Cancelled",
  no_show: "No-show", awaiting_verification: "Awaiting Verification",
  paid: "Paid", expired: "Expired", rejected: "Rejected",
};
function Badge({ value }) { const { t } = useLanguage(); return <span className={`badge status-${value}`}>{t(labels[value] || value)}</span>; }
function Feedback({ error, message }) { return <>{error && <p className="error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}</>; }
function Loading({ state }) { return state.error ? <p className="error" role="alert">{state.error}</p> : state.loading ? <p role="status">Loading…</p> : null; }

const tabs = [
  ["pending_confirmation", "Pending Confirmations"],
  ["confirmed", "Confirmed"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["", "All Appointments"],
];
const initials = (name = "Customer") =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const displayDate = (value) => new Intl.DateTimeFormat("en-LS", {
  dateStyle: "medium",
  timeZone: "Africa/Maseru",
}).format(new Date(value));

function CustomerWhatsApp({ appointment }) {
  const { t } = useLanguage();
  const number = normalizeInternationalPhone(appointment.customerWhatsAppNumber);
  const customerName = appointment.customer?.name || appointment.guestCustomer?.name || "Customer";
  const confirmed = appointment.paymentStatus === "paid" && ["confirmed", "in_progress", "completed"].includes(appointment.status);
  const contactAlternative = appointment.customer?.email
    ? <a href={`mailto:${appointment.customer.email}`}>Email customer instead</a>
    : appointment.guestCustomer?.phone
      ? <a href={`tel:${appointment.guestCustomer.phone}`}>Call customer instead</a>
      : null;
  if (!number)
    return <div className="appointment-wa-unavailable"><button type="button" className="button secondary appointment-whatsapp" disabled aria-describedby="customer-whatsapp-unavailable">{t("Message Customer on WhatsApp")}</button><span id="customer-whatsapp-unavailable">{t("No valid customer WhatsApp number was provided. The professional's WhatsApp number cannot be used as the customer's destination.")}{contactAlternative && <> {contactAlternative}</>}</span></div>;
  const message = confirmed
    ? `Hello ${customerName}!\n\nYour appointment has been confirmed.\n\nSalon: ${appointment.professionalBusinessName || appointment.professional?.name || "Salon"}\nService: ${appointment.serviceName}\nDate: ${displayDate(appointment.startsAt)}\nTime: ${new Intl.DateTimeFormat("en-LS", { timeStyle: "short", timeZone: "Africa/Maseru" }).format(new Date(appointment.startsAt))}\nBooking Reference: ${appointment.reference}\n\nThank you for booking with us!`
    : `Hello ${customerName}, I am contacting you about appointment request ${appointment.reference}.\n\nService: ${appointment.serviceName}\nDate and time: ${dateTime(appointment.startsAt)} (Africa/Maseru)\nBooking fee: ${money(appointment.feeLisente)}\n\nYour appointment is not confirmed yet. Please contact me to discuss the external payment arrangement. Payment is confirmed only after I independently verify receipt.`;
  return <a className="button secondary appointment-whatsapp" target="_blank" rel="noreferrer" href={`https://wa.me/${number.slice(1)}?text=${encodeURIComponent(message)}`}>{t("Message Customer on WhatsApp")}</a>;
}

function AppointmentDetails({ appointment, onClose, onChanged }) {
  const { t } = useLanguage();
  const online = useOnline();
  const dialogRef = useRef(null);
  const payments = useData(`/payments?appointment=${appointment._id}&limit=100`);
  const [method, setMethod] = useState("cash");
  const [receiptReference, setReceiptReference] = useState("");
  const [received, setReceived] = useState(false);
  const [confirmReceived, setConfirmReceived] = useState(false);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = appointment.status === "pending_confirmation";
  const awaitingFee = payments.data?.items?.find((payment) => payment.kind === "booking_fee" && payment.status === "awaiting_verification");
  const canCancel = !["cancelled", "completed", "no_show", "in_progress"].includes(appointment.status);
  useEffect(() => {
    dialogRef.current?.focus();
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function recordReceipt(event) {
    event.preventDefault();
    if (!online || !received || busy) {
      if (!online) setError(t("Payment recording requires an internet connection and is never queued offline."));
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await request("/payments", { method: "POST", body: {
        appointment: appointment._id,
        amountLisente: appointment.feeLisente,
        method,
        reference: receiptReference.trim(),
        kind: "booking_fee",
      }});
      setReceiptReference(""); setReceived(false);
      setNotice("Receipt recorded as Awaiting Verification. Independently check the funds before verifying.");
      await payments.reload();
      onChanged("payment-recorded");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function verifyPayment() {
    if (!online || !awaitingFee || !confirmReceived || busy) {
      if (!online) setError(t("Payment verification requires an internet connection and is never queued offline."));
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await request(`/payments/${awaitingFee._id}/review`, { method: "POST", body: {
        action: "verify",
        note: "Professional independently confirmed actual booking-fee receipt.",
      }});
      setConfirmReceived(false);
      onClose();
      await payments.reload();
      onChanged("verified");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function change(action, startsAt) {
    if (!online || busy) {
      if (!online) setError(t("Appointment changes require an internet connection and are not queued offline."));
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await request(`/appointments/${appointment._id}/action`, { method: "POST", body: {
        action,
        ...(startsAt ? { startsAt: new Date(`${startsAt}:00+02:00`).toISOString() } : {}),
      }});
      setNotice(action === "cancel" ? "Appointment cancelled." : "Appointment updated.");
      onChanged(action);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="appointment-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="appointment-detail-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-detail-heading">
      <header className="appointment-detail-header"><div><p className="eyebrow">{t("BOOKING DETAILS")}</p><h2 id="appointment-detail-heading">{appointment.reference}</h2></div><button type="button" className="appointment-close" onClick={onClose} aria-label={t("Close appointment details")}>×</button></header>
      <Feedback error={error} message={notice} />
      {!online && <p className="offline-action-note" role="status">{t("Booking changes and payment actions are unavailable offline. Nothing will be queued.")}</p>}
      <dl className="appointment-detail-grid">
        <dt>{t("Customer")}</dt><dd>{appointment.customer?.name || appointment.guestCustomer?.name || t("Guest customer")}</dd>
        <dt>{t("Customer contact")}</dt><dd>{appointment.customer?.email || appointment.guestCustomer?.phone || t("Not provided")}</dd>
        <dt>{t("Customer WhatsApp")}</dt><dd>{appointment.customerWhatsAppNumber || t("Not provided")}</dd>
        <dt>{t("Service")}</dt><dd>{appointment.serviceName}</dd>
        <dt>{t("Professional")}</dt><dd>{appointment.professionalBusinessName || appointment.professional?.name || "—"}</dd>
        <dt>{t("Date & time")}</dt><dd>{dateTime(appointment.startsAt)} · {appointment.durationMinutes} {t("min")}</dd>
        <dt>{t("Service price")}</dt><dd>{money(appointment.priceLisente)}</dd>
        <dt>{t("Booking fee")}</dt><dd>{money(appointment.feeLisente)}</dd>
        <dt>{t("Appointment status")}</dt><dd><Badge value={appointment.status} /></dd>
        <dt>{t("Payment status")}</dt><dd><Badge value={appointment.paymentStatus || "awaiting_payment"} /></dd>
        <dt>{t("Request received")}</dt><dd>{dateTime(appointment.createdAt)}</dd>
        {appointment.holdExpiresAt && <><dt>{t("Hold expires")}</dt><dd>{dateTime(appointment.holdExpiresAt)}</dd></>}
      </dl>
      <details className="appointment-policy"><summary>Accepted booking policy (version {appointment.policyVersion})</summary><p>{appointment.policyText}</p><p>Accepted {dateTime(appointment.policyAcceptedAt)}</p></details>
      <section className="appointment-payment-history"><h3>{t("Payment history")}</h3><Loading state={payments} />{payments.data?.items.length ? payments.data.items.map((payment) => <article className="payment-history-row" key={payment._id}><div><strong>{t(payment.kind === "booking_fee" ? "Booking fee" : "Service balance")}</strong><small>{t(payment.method)} · {t("Reference")} {payment.reference}</small></div><div><strong>{money(payment.amountLisente)}</strong><Badge value={payment.status} />{payment.verifiedAt && <small>{t("Verified")} {dateTime(payment.verifiedAt)} {t("by")} {payment.verifiedBy?.name || t("professional")}</small>}</div></article>) : !payments.loading && <p>{t("No payment records. Payment arrangement happens outside the website.")}</p>}</section>
      {pending && !awaitingFee && <form className="appointment-record-payment" onSubmit={recordReceipt}>
        <h3>{t("Record actual booking fee received")}</h3><p>{t("Record only after funds have actually arrived. Amount is fixed from the booking snapshot:")} <strong>{money(appointment.feeLisente)}</strong>.</p>
        <label>{t("Payment method")}<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">{t("Cash")}</option><option value="mobile_money_manual">{t("Mobile money")}</option><option value="mobile_money_agent">{t("Mobile money agent")}</option><option value="bank_transfer">{t("Bank transfer")}</option></select></label>
        <label>{t("Actual receipt / transaction reference")}<input required minLength={3} maxLength={100} value={receiptReference} onChange={(event) => setReceiptReference(event.target.value)} /></label>
        <label className="checkbox"><input type="checkbox" checked={received} onChange={(event) => setReceived(event.target.checked)} />{t("I have actually received this booking fee outside the website.")}</label>
        <button className="button" disabled={!online || busy || !received || receiptReference.trim().length < 3}>{busy ? t("Recording…") : t("Record Payment Awaiting Verification")}</button>
      </form>}
      {pending && awaitingFee && <div className="appointment-verify-panel"><h3>{t("Payment is awaiting independent verification")}</h3><p>{t("Recorded")} {money(awaitingFee.amountLisente)} {t("via")} {t(awaitingFee.method)} · {awaitingFee.reference}</p><label className="checkbox"><input type="checkbox" checked={confirmReceived} onChange={(event) => setConfirmReceived(event.target.checked)} />{t("I independently verified that these funds were actually received.")}</label><button className="button" disabled={!online || busy || !confirmReceived} onClick={verifyPayment}>{busy ? t("Verifying…") : t("Verify Payment & Confirm Appointment")}</button></div>}
      <div className="appointment-detail-actions">
        {canCancel && <button type="button" disabled={!online || busy} onClick={() => change("cancel")}>{t("Cancel appointment")}</button>}
        {!['cancelled', 'completed', 'no_show', 'in_progress'].includes(appointment.status) && <label className="appointment-reschedule-field">{t("Reschedule · local time")}<input type="datetime-local" value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} /></label>}
        {rescheduleTime && canCancel && <button type="button" disabled={!online || busy} onClick={() => change("reschedule", rescheduleTime)}>{t("Save new time")}</button>}
        <CustomerWhatsApp appointment={appointment} />
      </div>
    </section>
  </div>;
}

export function ProfessionalAppointments({ initialTab = "" }) {
  const { t } = useLanguage();
  const overview = useData("/professional/overview");
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const endpoint = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), limit: "25", search });
    if (tab) query.set("status", tab);
    if (dateFrom) query.set("from", dateFrom);
    if (dateTo) query.set("to", dateTo);
    return `/appointments?${query.toString()}`;
  }, [page, search, tab, dateFrom, dateTo]);
  const appointments = useData(endpoint);
  const selected = appointments.data?.items?.find((item) => item._id === selectedId);
  const counts = overview.data?.appointmentStatuses || {};
  function updateFilter(update) { setPage(1); update(); }
  const onChanged = (action) => {
    appointments.reload(); overview.reload();
    setNotice(action === "verified"
      ? "Payment verified and appointment confirmed. Customer notification/email is queued through the configured delivery system."
      : action === "payment-recorded"
        ? "Payment recorded awaiting verification."
        : action === "cancel"
          ? "Appointment cancelled."
          : action === "reschedule"
            ? "Appointment rescheduled."
            : "Appointment updated.");
  };
  return <div className="professional-appointments-page">
    <Feedback message={notice} />
    <div className="appointment-tab-list" aria-label="Appointment status filters">
      {tabs.map(([status, title]) => {
        const count = status === "confirmed"
          ? (counts.confirmed || 0) + (counts.in_progress || 0)
          : status ? counts[status] ?? 0 : overview.data?.appointments ?? 0;
        return <button key={title} type="button" aria-pressed={tab === status} className={tab === status ? "appointment-tab active" : "appointment-tab"} onClick={() => { setTab(status); setPage(1); }}>
          {t(title)}<span className="appointment-tab-count">{count}</span>
        </button>;
      })}
    </div>
    <div className="appointment-filters">
      <label className="appointment-search">{t("Search appointments")}<input type="search" value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} placeholder={t("Customer, service or reference")} /></label>
      <label>{t("From")}<input type="date" max={dateTo || undefined} value={dateFrom} onChange={(event) => updateFilter(() => setDateFrom(event.target.value))} /></label>
      <label>{t("To")}<input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => updateFilter(() => setDateTo(event.target.value))} /></label>
      {(search || dateFrom || dateTo) && <button type="button" className="appointment-clear-filters" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setPage(1); }}>{t("Clear filters")}</button>}
    </div>
    <Loading state={appointments} />
    {appointments.data?.items.length === 0 && <p className="empty-message">{t("No appointments match these filters.")}</p>}
    {appointments.data?.items.length > 0 && <>
      <div className="appointment-table-wrap"><table className="appointment-table"><caption className="visually-hidden">{t("Professional appointments")}</caption><thead><tr><th>{t("Customer")}</th><th>{t("Service")}</th><th>{t("Appointment")}</th><th>{t("Booking Reference")}</th><th>{t("Booking Fee")}</th><th>{t("Payment Status")}</th><th>{t("Appointment Status")}</th><th>{t("Actions")}</th></tr></thead><tbody>
        {appointments.data.items.map((item) => <tr key={item._id}>
          <td><button className="appointment-customer-cell" type="button" onClick={() => setSelectedId(item._id)}><span className="appointment-avatar" aria-hidden="true">{initials(item.customer?.name || item.guestCustomer?.name)}</span><span><strong>{item.customer?.name || item.guestCustomer?.name || t("Guest customer")}</strong><small>{item.customerWhatsAppNumber || item.customer?.email || item.guestCustomer?.phone || t("No contact provided")}</small></span></button></td>
          <td>{item.serviceName}<small className="appointment-subtext">{money(item.priceLisente)}</small></td>
          <td>{displayDate(item.startsAt)}<small className="appointment-subtext">{new Intl.DateTimeFormat("en-LS", { timeStyle: "short", timeZone: "Africa/Maseru" }).format(new Date(item.startsAt))} · {item.durationMinutes} min</small></td>
          <td><button type="button" className="appointment-reference-link" onClick={() => setSelectedId(item._id)}>{item.reference}</button></td>
          <td>{money(item.feeLisente)}</td>
          <td><Badge value={item.paymentStatus || (item.status === "pending_confirmation" ? "awaiting_verification" : "awaiting_payment")} /></td>
          <td><Badge value={item.status} /></td>
          <td><button className="appointment-view-button" type="button" onClick={() => setSelectedId(item._id)}>{t("View details")}</button>{item.status === "pending_confirmation" && <button className="appointment-verify-quick" type="button" onClick={() => setSelectedId(item._id)}>{t("Verify payment")}</button>}</td>
        </tr>)}</tbody></table></div>
      <div className="appointment-mobile-list">{appointments.data.items.map((item) => <article className="appointment-mobile-card" key={item._id}>
        <div className="appointment-mobile-card-header"><span className="appointment-avatar" aria-hidden="true">{initials(item.customer?.name || item.guestCustomer?.name)}</span><div><strong>{item.customer?.name || item.guestCustomer?.name || t("Guest customer")}</strong><small>{item.customerWhatsAppNumber || item.customer?.email || item.guestCustomer?.phone || t("No contact provided")}</small></div><Badge value={item.status} /></div>
        <p><strong>{item.serviceName}</strong> · {money(item.priceLisente)}</p><p>{dateTime(item.startsAt)} · {t("Booking Fee")} {money(item.feeLisente)}</p><p><span>{t("Payment")} </span><Badge value={item.paymentStatus || (item.status === "pending_confirmation" ? "awaiting_verification" : "awaiting_payment")} /></p><button className="button secondary" type="button" onClick={() => setSelectedId(item._id)}>{t(item.status === "pending_confirmation" ? "Review & verify payment" : "View appointment details")}</button>
      </article>)}</div>
      <div className="appointment-pagination"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>{t("Previous")}</button><span>{t("Page")} {page} · {appointments.data.total} {t("appointments")}</span><button type="button" disabled={page * appointments.data.limit >= appointments.data.total} onClick={() => setPage((value) => value + 1)}>{t("Next")}</button></div>
    </>}
    {selected && <AppointmentDetails appointment={selected} onClose={() => setSelectedId("")} onChanged={onChanged} />}
  </div>;
}
