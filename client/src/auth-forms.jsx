import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { request } from "./api.js";

function AuthPanel({ eyebrow, title, children }) {
  return <section className="container section narrow"><div className="panel auth-form"><p className="studio-kicker">{eyebrow}</p><h1>{title}</h1>{children}</div></section>;
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const token = params.get("token") || "";
  async function verify() {
    setBusy(true); setError(""); setMessage("");
    try { const result = await request("/auth/verify-email", { method: "POST", body: { token } }); setMessage(result.message); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function resend(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { const result = await request("/auth/resend-verification", { method: "POST", body: { email } }); setMessage(result.message); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <AuthPanel eyebrow="EMAIL VERIFICATION" title={token ? "Verify your email." : "Need a new verification link?"}>
    {token ? <button className="button" disabled={busy} onClick={verify}>{busy ? "Verifying…" : "Verify email address"}</button> : <form className="form-grid" onSubmit={resend}><label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="button" disabled={busy}>{busy ? "Sending…" : "Resend verification link"}</button></form>}
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}<p><Link to="/login">Return to sign in</Link></p>
  </AuthPanel>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");
  async function submit(event){event.preventDefault();setBusy(true);setError("");setMessage("");try{const result=await request("/auth/forgot-password",{method:"POST",body:{email:email.trim().toLowerCase()}});setMessage(result.message);}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <AuthPanel eyebrow="ACCOUNT RECOVERY" title="Reset your password."><form className="form-grid" onSubmit={submit}><p>Enter your account email. If an active account matches, reset instructions will be sent when email delivery is configured.</p><label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event)=>setEmail(event.target.value)} /></label><button className="button" disabled={busy}>{busy?"Requesting…":"Send reset link"}</button></form>{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}<p><Link to="/login">Return to sign in</Link></p></AuthPanel>;
}

export function ResetPasswordPage() {
  const [params]=useSearchParams();const token=params.get("token")||"";const [password,setPassword]=useState("");const [confirm,setConfirm]=useState("");const [error,setError]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  async function submit(event){event.preventDefault();setError("");setMessage("");if(password!==confirm){setError("Passwords do not match.");return;}if(!token){setError("This reset link is missing or invalid. Request another link.");return;}setBusy(true);try{const result=await request("/auth/reset-password",{method:"POST",body:{token,password}});setMessage(result.message);}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <AuthPanel eyebrow="ACCOUNT RECOVERY" title="Choose a new password."><form className="form-grid" onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password} onChange={(event)=>setPassword(event.target.value)} /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={confirm} onChange={(event)=>setConfirm(event.target.value)} /></label><small>Use 12 to 72 UTF-8 bytes. The reset link expires after 30 minutes and works once.</small><button className="button" disabled={busy}>{busy?"Saving…":"Reset password"}</button></form>{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}<p><Link to="/login">Return to sign in</Link></p></AuthPanel>;
}
