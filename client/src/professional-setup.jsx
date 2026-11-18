import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { request } from "./api.js";
import { useAuth } from "./state.jsx";
import { useLanguage } from "./i18n.jsx";

export function ProfessionalSetupPage() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);
  const { setSession } = useAuth();
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setError("");
    setFieldError("");
    const trimmed = name.trim();
    if (!/^[\p{L}\p{M}]+(?:[ '\u2019\u02bc-]+[\p{L}\p{M}]+)*$/u.test(trimmed) || trimmed.length < 2 || trimmed.length > 100) {
      setFieldError(t("Enter your name using letters, spaces, apostrophes, or hyphens."));
      return;
    }
    if (new TextEncoder().encode(password).length < 12 || new TextEncoder().encode(password).length > 72) {
      setFieldError(t("Use a password of at least 12 characters and no more than 72 UTF-8 bytes."));
      return;
    }
    if (password !== confirmation) {
      setFieldError(t("Passwords do not match."));
      return;
    }
    if (!token) {
      setError(t("This invitation link is missing its setup token. Ask an administrator to send a new invitation."));
      return;
    }
    setBusy(true);
    try {
      const session = await request("/auth/professional-setup", {
        method: "POST",
        body: { token, name: trimmed, password },
      });
      setSession(session);
      navigate("/professional/settings", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setPassword("");
      setConfirmation("");
    }
  }

  return <section className="container section narrow">
    <div className="panel auth-form">
      <p className="studio-kicker">{t("PROFESSIONAL ACCOUNT SETUP")}</p>
      <h1>{t("Secure your professional account.")}</h1>
      <p>{t("This one-time link verifies that you control the invited email address. Choose your own password; no temporary password is sent or shown.")}</p>
      {!token && <p className="error" role="alert">{t("Invitation token is missing. Request a new setup invitation from the administrator.")}</p>}
      <form className="form-grid" noValidate onSubmit={submit}>
        <label>{t("Your name")}<input autoComplete="name" maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(fieldError)} /></label>
        <label>{t("Create password")}<input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>{t("Confirm password")}<input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <small>{t("Passwords must be at least 12 characters and no more than 72 UTF-8 bytes. The one-time invitation expires after 24 hours.")}</small>
        {fieldError && <p className="field-error" role="alert">{fieldError}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button" disabled={busy || !token}>{t(busy ? "Securing account…" : "Verify email and set password")}</button>
      </form>
      <p>{t("After setup, add your actual business name and WhatsApp number in Settings. Your profile remains unpublished and online bookings remain unavailable until you configure it.")}</p>
      <Link to="/login">{t("Return to sign in")}</Link>
    </div>
  </section>;
}
