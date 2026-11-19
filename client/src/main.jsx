import { ConnectionBanner } from "./offline.jsx";
import { GoogleButton } from "./google.jsx";
import {
  ProfessionalOverview,
  CustomerOverview,
  ProfessionalDirectory,
} from "./dashboard.jsx";
import {
  PublicAdvertisements,
  ProfessionalPublicProfile,
  AdvertisementManagement,
} from "./advertisements.jsx";
import React, { useContext, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  Outlet,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
  useNavigationType,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Scissors,
  Sparkles,
  Menu,
  X,
  CalendarDays,
  Users,
  LayoutDashboard,
  CreditCard,
  Settings,
  ChartNoAxesCombined,
  Receipt,
  UserRound,
  LogOut,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Auth, Providers, useBusiness, useData } from "./state.jsx";
import { request, money, mediaUrl } from "./api.js";
import {
  Booking,
  WhatsApp,
  Appointments,
  Manage,
  Payments,
  Reports,
  SettingsPage,
  Profile,
  NotificationHistory,
  AuditHistory,
} from "./operations.jsx";
import { roleHome } from "./roles.js";
import { ProfessionalAppointments } from "./appointment-table.jsx";
import { normalizeInternationalPhone } from "./phone.js";
import { VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage } from "./auth-forms.jsx";
import { ProfessionalSetupPage } from "./professional-setup.jsx";
import { findServiceInspiration, ServicePhoto } from "./service-photos.jsx";
import { LanguageProvider, LanguageSwitcher, useLanguage } from "./i18n.jsx";
import {
  PlatformOverview,
  PlatformAccounts,
  PlatformSettingsPage,
  ProfessionalAvailability,
} from "./platform.jsx";
const professionalItems = [
  ["", "Overview", LayoutDashboard],
  ["appointments", "Appointments", CalendarDays],
  ["customers", "Customers", Users],
  ["services", "Services", Scissors],
  ["pending-confirmations", "Pending Confirmations", ShieldCheck],
  ["payments", "Payments", CreditCard],
  ["expenses", "Expenses", Receipt],
  ["reports", "Reports", ChartNoAxesCombined],
  ["availability", "Availability", Clock],
  ["advertisements", "Advertisements", Sparkles],
  ["book", "New booking", CalendarDays],
  ["settings", "Settings", Settings],
  ["notifications", "Notifications", Sparkles],
  ["audit", "Audit history", ShieldCheck],
  ["profile", "Profile", UserRound],
];
const customerItems = [
  ["", "Overview", LayoutDashboard],
  ["appointments", "My appointments", CalendarDays],
  ["history", "Booking history", Clock],
  ["payments", "Payment status", CreditCard],
  ["professionals", "Browse professionals", Users],
  ["book", "Book a service", Scissors],
  ["profile", "Account settings", UserRound],
  ["notifications", "Notifications", Sparkles],
];
const platformItems = [
  ["", "Overview", LayoutDashboard],
  ["accounts", "Accounts", Users],
  ["settings", "Platform Settings", Settings],
  ["audit", "Platform Audit", ShieldCheck],
  ["notifications", "Notifications", Sparkles],
  ["profile", "Profile", UserRound],
];
// Keep every route available, but show only the essential destinations in the sidebar.
const professionalNavigation = ["", "appointments", "services", "customers", "notifications", "profile"];
const customerNavigation = ["", "professionals", "appointments"];
const adminNavigation = ["", "accounts", "settings"];
const workspaceNavigation = (role) => {
  const all = role === "admin" ? platformItems : role === "professional" ? professionalItems : customerItems;
  const visible = role === "admin" ? adminNavigation : role === "professional" ? professionalNavigation : customerNavigation;
  return all.filter(([path]) => visible.includes(path));
};
function Brand() {
  const business = useBusiness();
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <Scissors size={22} />
      </span>
      <span>
        {business?.platformName || business?.salonName || "The Salon"}
        <span className="brand-sub">
          LESOTHO {business?.demo ? "· DEMONSTRATION" : ""}
        </span>
      </span>
    </Link>
  );
}
function scrollToHomeSection(id, behavior = "smooth") {
  const target = document.getElementById(id);
  if (!target) return false;
  target.scrollIntoView({ behavior, block: "start" });
  return true;
}
function HomeSectionScroll() {
  const { pathname, hash, key } = useLocation();
  useEffect(() => {
    if (pathname !== "/") return;
    const id = hash ? decodeURIComponent(hash.slice(1)) : "home";
    let frame;
    let attempts = 0;
    const tryScroll = () => {
      if (scrollToHomeSection(id, hash ? "smooth" : "auto")) return;
      if (++attempts < 45) frame = requestAnimationFrame(tryScroll);
    };
    frame = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash, key]);
  return null;
}
function PageScrollManager() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (pathname !== "/" && navigationType !== "POP") window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, navigationType]);
  return null;
}
function HomeNavLink({ section, children, className }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return <a href={`/#${section}`} className={className} onClick={(event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (pathname !== "/") {
      navigate(`/#${section}`);
    } else {
      // Always scroll, even when the hash hasn't changed.
      window.history.replaceState(window.history.state, "", `/#${section}`);
      scrollToHomeSection(section);
    }
  }}>{children}</a>;
}
function Layout() {
  const business = useBusiness();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { session, setSession } = useContext(Auth);
  return (
    <div className="public-site">
      <ConnectionBanner />
      <HomeSectionScroll />
      <PageScrollManager />
      <header>
        <div className="container header-inner">
          <Brand />
          <button
            className="menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav
            className={open ? "nav open" : "nav"}
            aria-label="Main navigation"
            onClick={() => setOpen(false)}
          >
            <HomeNavLink section="home">{t("Home")}</HomeNavLink>
            <HomeNavLink section="services-preview">{t("Services")}</HomeNavLink>
            {session ? (
              <>
                <Link className="studio-nav-cta" to={roleHome(session.user.role)}>{t("My account")} <ArrowUpRight size={15} /></Link>
                <button className="studio-signout" onClick={() => setSession(null)}>{t("Sign out")}</button>
              </>
            ) : (
              <HomeNavLink className="studio-nav-cta" section="login">{t("Log in")} <ArrowUpRight size={15} /></HomeNavLink>
            )}
            <LanguageSwitcher />
          </nav>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer>
        <div className="container footer-grid">
          <div>
            <Brand />
            <p>A thoughtful space for your next chapter.</p>
            {business?.publicContentStatus === "verified_identity_only" && (
              <small>Verified location information. Services and prices will appear after the salon verifies them.</small>
            )}
          </div>
          <div>
            <p className="eyebrow">EXPLORE</p>
            <HomeNavLink section="services-preview">Our services</HomeNavLink>
            <HomeNavLink section="home">Our story</HomeNavLink>
            <HomeNavLink section="professionals">Find professionals</HomeNavLink>
          </div>
          <div>
            <p className="eyebrow">YOUR VISIT</p>
            <Link to="/book">Appointments</Link>
            <Link to="/register">Create an account</Link>
            <p>{business?.address || "Location details are not yet published."}</p>
          </div>
        </div>
        <div className="container footer-bottom">
          © {new Date().getFullYear()}{" "}
          {business?.platformName || business?.salonName || "The Salon"}{" "}
          <span>Care, in every detail.</span>
        </div>
      </footer>
    </div>
  );
}
function ServiceCards({ carousel = false }) {
  const state = useData("/public/services?limit=100");
  const items = state.data?.items || [];
  const location = useLocation();
  const [activeIndex, setActiveIndex] = useState(() => Number.isInteger(location.state?.featuredIndex) ? location.state.featuredIndex : 0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const active = items[activeIndex % Math.max(items.length, 1)];
  useEffect(() => {
    if (!carousel || items.length < 2 || paused || interacting || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let fadeTimer;
    const timer = window.setInterval(() => {
      setVisible(false);
      fadeTimer = window.setTimeout(() => {
        setActiveIndex((current) => (current + 1) % items.length);
        setVisible(true);
      }, 220);
    }, 3000);
    return () => { window.clearInterval(timer); window.clearTimeout(fadeTimer); };
  }, [carousel, items.length, paused, interacting]);
  function selectSlide(index) {
    setVisible(true);
    setActiveIndex((index + items.length) % items.length);
  }
  return (
    <>
      {state.loading && <p role="status">Loading services…</p>}
      {state.error && <div><p className="error" role="alert">Services are temporarily unavailable.</p><button type="button" onClick={state.reload}>Try again</button></div>}
      {!state.loading && !state.error && items.length === 0 && <p>No active services are currently available.</p>}
      {carousel && active ? (
        <section className={`salon-featured-story${visible ? "" : " is-fading"}`} aria-label="Featured salon service" aria-roledescription="carousel"
          onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
          onFocusCapture={() => setInteracting(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}>
          <Link className="salon-featured-photo" to={`/services/${active._id}`} state={{ from: "featured", featuredIndex: activeIndex, returnTo: "/#services-preview", returnLabel: "← Back to featured services" }} aria-label={`View ${active.name}`}>
            {active.imageUrl || findServiceInspiration(active) ? <ServicePhoto service={active} /> : <span className="salon-featured-placeholder"><Scissors size={70} strokeWidth={1.1} /></span>}
            <span className="salon-featured-photo-label">FEATURED SERVICE</span>
          </Link>
          <div className="salon-featured-copy">
            <span className="salon-featured-eyebrow">A GOOD PLACE TO BEGIN · SALON SERVICE</span>
            <h3>{active.name}</h3>
            <p className="salon-featured-professional">{active.professionalName}</p>
            <p>{active.description || "Explore this service and book with the professional."}</p>
            <div className="salon-featured-price"><strong>{money(active.priceLisente)}</strong><span>{active.durationMinutes} min</span></div>
            <div className="salon-featured-actions">
              <Link to={`/services/${active._id}`} state={{ from: "featured", featuredIndex: activeIndex, returnTo: "/#services-preview", returnLabel: "← Back to featured services" }} className="salon-featured-link">Explore service <ArrowUpRight size={16} /></Link>
              <button type="button" className="salon-featured-pause" onClick={() => { setPaused((value) => !value); setInteracting(false); }} aria-label={paused ? "Resume service slideshow" : "Pause service slideshow"}>{paused ? "▶" : "Ⅱ"}</button>
            </div>
            <div className="salon-featured-bottom"><span>{String(activeIndex + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")} IN THE COLLECTION</span>
              {items.length > 1 && <div className="salon-featured-step"><button type="button" onClick={() => selectSlide(activeIndex - 1)} aria-label="Previous service">←</button><button type="button" onClick={() => selectSlide(activeIndex + 1)} aria-label="Next service">→</button></div>}
            </div>
          </div>
        </section>
      ) : !carousel && <div className="discovery-grid" aria-label="All services">
        {items.map((item, i) => (
          <Link className="discovery-card" to={`/services/${item._id}`} state={{ from: "all-services", returnTo: "/services", returnLabel: "← Back to all services" }} key={item._id} aria-label={`View ${item.name} details`}>
            <div className="discovery-media">
              {item.imageUrl || findServiceInspiration(item) ? <ServicePhoto service={item} /> : <span className="discovery-placeholder"><Scissors size={48} strokeWidth={1.2}/></span>}
              <span className="discovery-number">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div className="discovery-body">
              <div className="discovery-kicker"><span>SALON SERVICE</span><ArrowUpRight size={18}/></div>
              <h3>{item.name}</h3><p className="discovery-subtitle">{item.professionalName}</p>
              <p className="discovery-description">{item.description || "Explore this service and book with the professional."}</p>
              <div className="discovery-meta"><strong>{money(item.priceLisente)}</strong><span>{item.durationMinutes} min</span></div>
            </div>
          </Link>
        ))}
      </div>}
    </>
  );
}
function ServiceDetail() {
  const { id } = useParams();
  const location = useLocation();
  const fromFeatured = location.state?.from === "featured";
  const backTarget = location.state?.returnTo || (fromFeatured ? "/#services-preview" : "/services");
  const backLabel = location.state?.returnLabel || (fromFeatured ? "← Back to featured services" : "← Back to all services");
  const backState = fromFeatured ? { featuredIndex: location.state.featuredIndex } : undefined;
  const state = useData("/public/services?limit=100");
  const item = state.data?.items.find((entry) => entry._id === id);
  return <section className="container section">
    <Link className="detail-back" to={backTarget} state={backState}>{backLabel}</Link>
    {state.loading && <p>Loading service…</p>}
    {state.error && <p className="error" role="alert">{state.error}</p>}
    {!state.loading && !state.error && !item && <p>Service not found or no longer available.</p>}
    {item && <div className="discovery-detail">
      <div className="detail-image">{item.imageUrl || findServiceInspiration(item) ? <ServicePhoto service={item} /> : <span className="discovery-placeholder"><Scissors size={76} strokeWidth={1}/></span>}</div>
      <div className="detail-copy">
        <p className="discovery-kicker">SALON SERVICE</p>
        <h1>{item.name}</h1>
        <p className="discovery-subtitle">By {item.professionalName}</p>
        <p>{item.description || "Contact the professional for more details about this service."}</p>
        <div className="detail-fact"><small>PRICE</small><strong>{money(item.priceLisente)}</strong></div>
        <div className="detail-fact"><small>DURATION</small><strong>{item.durationMinutes} minutes</strong></div>
        <Link className="button" to={`/book?professional=${encodeURIComponent(item.professional)}&service=${encodeURIComponent(item._id)}`} state={{ returnTo: location.pathname + location.search, returnLabel: "← Back to service details" }}>Book this service <ArrowUpRight size={18}/></Link>
      </div>
    </div>}
  </section>;
}
function BookingPage() {
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  return <>
    {returnTo && <div className="container" style={{ paddingTop: "1.25rem" }}>
      <Link className="detail-back" to={returnTo}>{location.state?.returnLabel || "← Back to previous page"}</Link>
    </div>}
    <Booking />
  </>;
}
function Home() {
  const business = useBusiness();
  const { t } = useLanguage();
  return (
    <>
      <section className="studio-home-hero" id="home">
        <div className="studio-home-hero-inner container">
          <p className="eyebrow">{t("A SPACE FOR YOUR KIND OF BEAUTY")}</p>
          <h1>{t("Make room for")}<br /><em>{t("what makes you feel good.")}</em></h1>
          <p>{t("Discover independent beauty professionals, explore their services and book a moment for yourself.")}</p>
          <Link className="studio-hero-cta" to="/book">{t("Book appointment")} <ArrowUpRight size={18}/></Link>
        </div>
      </section>
      <section className="container section" id="featured">
        <h2>{t("Professional advertisements")}</h2>
        <PublicAdvertisements />
      </section>
<section className="section container" id="services-preview">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE SERVICE EDIT</p>
            <h2>{t("Find your feel-good.")}</h2>
          </div>
        </div>
        {business?.demo && (
          <p className="demo-notice">
            Demonstration menu — these are synthetic services and prices, not a
            real salon offer.
          </p>
        )}
        <ServiceCards carousel />
        <div className="service-view-all"><Link className="button" to="/services">{t("View all services")} <ArrowUpRight size={17}/></Link></div>
      </section>
      <section className="container section" id="professionals">
        <div className="section-heading"><div><p className="eyebrow">THE PEOPLE BEHIND THE CARE</p><h2>Meet the professionals.</h2></div></div>
        <ContactCards />
      </section>
      <AuthPage embedded />
    </>
  );
}
function PageTitle({ label, title, children }) {
  return (
    <div className="page-title">
      <p className="eyebrow">{label}</p>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
function Services() {
  const business = useBusiness();
  const { t } = useLanguage();
  return <section className="container section">
    <PageTitle label={t("THE SERVICE EDIT")} title={t("All services")}>{t("Browse every available service and select one to see details and book.")}</PageTitle>
    {business?.publicContentStatus === "verified_identity_only" && <p className="notice">The salon location is verified. Service names, prices and booking times will appear after the salon verifies the catalogue.</p>}
    <ServiceCards />
  </section>;
}
function ContactCards() {
  const state = useData("/public/professionals");
  return (
    <>
      {state.loading && <p role="status">Loading professionals…</p>}
      {state.error && <div><p className="error" role="alert">Professional information is temporarily unavailable.</p><button type="button" onClick={state.reload}>Try again</button></div>}
      {state.data?.items.length === 0 && (
        <p>No professional business profiles are published yet.</p>
      )}
      <div className="discovery-grid">
        {state.data?.items.map((p, i) => (
          <Link className="discovery-card" to={`/professionals/${p.professional}`} state={{ returnTo: "/#professionals", returnLabel: "Back to professionals on home" }} key={p.professional}>
            <div className="discovery-media">{p.photoUrl ? <img src={mediaUrl(p.photoUrl)} alt={p.salonName} loading="lazy"/> : <span className="discovery-placeholder"><UserRound size={56} strokeWidth={1.1}/></span>}<span className="discovery-number">{String(i + 1).padStart(2, "0")}</span></div>
            <div className="discovery-body">
              <div className="discovery-kicker"><span>BEAUTY PROFESSIONAL</span><ArrowUpRight size={18}/></div>
              <h3>{p.salonName}</h3>
              <p className="discovery-subtitle">{p.address || "Lesotho"}</p>
              <p className="discovery-description">{p.description || "View services, availability and contact details."}</p>
              <div className="discovery-meta"><span>View profile and contact</span><ArrowRight size={17}/></div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
function Contact() {
  const { t } = useLanguage();
  return <section className="container section"><PageTitle label={t("OUR PROFESSIONALS")} title={t("Find your professional.")} /><ContactCards /></section>;
}
function validateAuthField(field, value, register) {
  const text = String(value || "");
  if (field === "name" && register) {
    const name = text.trim();
    if (name.length < 2) return "Enter a name with at least 2 characters.";
    if (name.length > 100) return "Name must be 100 characters or fewer.";
    if (!/^[\p{L}\p{M}]+(?:[ '\u2019\u02bc-]+[\p{L}\p{M}]+)*$/u.test(name))
      return "Use letters, spaces, apostrophes, or hyphens for the name.";
  }
  if (field === "email") {
    const email = text.trim();
    if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email))
      return "Enter a valid email address.";
  }
  if (field === "password") {
    if (!text.length) return "Enter your password.";
    if (register && (text.length < 12 || new TextEncoder().encode(text).length > 72))
      return "Use at least 12 characters and no more than 72 UTF-8 bytes.";
  }
  if (field === "whatsappNumber" && register && text && !normalizeInternationalPhone(text))
    return "Enter a valid international number, including country code, or leave this optional field blank.";
  return "";
}
function AuthPage({ register = false, embedded = false }) {
  const { session, setSession, loading } = useContext(Auth);
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedNext = searchParams.get("next") || "";
  const returnPath = /^\/(?!\/)/.test(requestedNext) ? requestedNext : "";
  const formRef = useRef(null);
  if (loading) return <p>Loading session…</p>;
  if (session) return embedded ? null : <Navigate to={returnPath || roleHome(session.user.role)} replace />;
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const nextErrors = {};
    if (register) nextErrors.name = validateAuthField("name", values.name, register);
    const email = String(values.email || "").trim().toLowerCase();
    nextErrors.email = validateAuthField("email", email, register);
    nextErrors.password = validateAuthField("password", values.password, register);
    if (register) nextErrors.whatsappNumber = validateAuthField("whatsappNumber", values.whatsappNumber, register);
    if (register && values.password !== values.confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    Object.keys(nextErrors).forEach((field) => { if (!nextErrors[field]) delete nextErrors[field]; });
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError(t("Please correct the highlighted fields."));
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    setBusy(true);
    setError("");
    const body = {
      email,
      password: values.password,
      ...(register ? { name: String(values.name || "").trim() } : {}),
      ...(register && values.whatsappNumber
        ? { whatsappNumber: normalizeInternationalPhone(values.whatsappNumber) }
        : {}),
    };
    try {
      const data = await request(`/auth/${register ? "register" : "login"}`, {
        method: "POST",
        body,
      });
      if (register && !data.token) {
        setError(data.message || "Account created. Check your email to verify the address before signing in.");
        setVerificationPending(true);
        return;
      }
      setSession(data);
      navigate(returnPath || roleHome(data.user.role));
    } catch (err) {
      const serverFields = Object.fromEntries(
        Object.entries(err.fieldErrors || {}).filter(([field]) =>
          ["name", "email", "password", "whatsappNumber"].includes(field),
        ),
      );
      if (Object.keys(serverFields).length) {
        setFieldErrors((current) => ({ ...current, ...serverFields }));
        setError(t("Please correct the highlighted fields."));
        form.querySelector('[aria-invalid="true"]')?.focus();
        return;
      }
      setError(
        err instanceof SyntaxError
          ? "The API is unavailable. Please try again later."
          : err.message === "Failed to fetch"
            ? "Cannot reach the salon API. Please try again later."
            : err.message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id={embedded ? "login" : undefined} className="container section studio-auth-wrap">
      <div className="studio-auth-intro">
        <p className="studio-kicker">{t("YOUR SALON SPACE")}</p>
        <h1>{t(register ? "Your next appointment, all in one place." : "Your beauty, all in one place.")}</h1>
        <p>{t(register ? "Discover independent professionals, explore their services and book with confidence." : "Sign in to discover services, manage your bookings and stay in touch with your professional.")}</p>
        <small>{t("Private and secure account access")}</small>
      </div>
      <form ref={formRef} noValidate className="panel auth-form studio-auth-form" onSubmit={submit}>
        <p className="studio-kicker">{register ? "CUSTOMER REGISTRATION" : "ACCOUNT SIGN IN"}</p>
        <h2>{t(register ? "Create your account." : "Welcome back.")}</h2>
        {register && (
          <label>
            {t("Full name")}
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "auth-name-error" : undefined}
              onBlur={(event) => setFieldErrors((current) => ({ ...current, name: validateAuthField("name", event.target.value, register) }))}
              onChange={() => setFieldErrors((current) => ({ ...current, name: "" }))}
            />
            {fieldErrors.name && <small id="auth-name-error" className="field-error" role="alert">{t(fieldErrors.name)}</small>}
          </label>
        )}
        <label>
          {t("Email address")}
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
            onBlur={(event) => setFieldErrors((current) => ({ ...current, email: validateAuthField("email", event.target.value, register) }))}
            onChange={() => setFieldErrors((current) => ({ ...current, email: "" }))}
          />
          {fieldErrors.email && <small id="auth-email-error" className="field-error" role="alert">{t(fieldErrors.email)}</small>}
        </label>
        <label>
          {t("Password")}
          <input
            type="password"
            name="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 12 : 1}
            maxLength={register ? 72 : 200}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "auth-password-error" : undefined}
            onBlur={(event) => setFieldErrors((current) => ({ ...current, password: validateAuthField("password", event.target.value, register) }))}
            onChange={() => setFieldErrors((current) => ({ ...current, password: "" }))}
          />
          {fieldErrors.password && <small id="auth-password-error" className="field-error" role="alert">{t(fieldErrors.password)}</small>}
        </label>
        {register && <>
          <label>{t("Confirm password")}<input type="password" name="confirmPassword" autoComplete="new-password" required aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? "auth-confirm-error" : undefined} onChange={() => setFieldErrors((current) => ({ ...current, confirmPassword: "" }))} /></label>
          {fieldErrors.confirmPassword && <small id="auth-confirm-error" className="field-error" role="alert">{t(fieldErrors.confirmPassword)}</small>}
          <label>{t("WhatsApp number (optional)")}<input name="whatsappNumber" type="tel" inputMode="tel" autoComplete="tel" placeholder="+266 56903048" maxLength={40} aria-invalid={Boolean(fieldErrors.whatsappNumber)} aria-describedby={fieldErrors.whatsappNumber ? "auth-whatsapp-error" : "auth-whatsapp-help"} onBlur={(event) => setFieldErrors((current) => ({ ...current, whatsappNumber: validateAuthField("whatsappNumber", event.target.value, register) }))} onChange={() => setFieldErrors((current) => ({ ...current, whatsappNumber: "" }))} /><small id="auth-whatsapp-help">{t("Optional. Used only if you choose to share a WhatsApp contact.")}</small></label>
          {fieldErrors.whatsappNumber && <small id="auth-whatsapp-error" className="field-error" role="alert">{t(fieldErrors.whatsappNumber)}</small>}
        </>}
        {register && (
          <small>Use at least 12 characters, up to 72 UTF-8 bytes.</small>
        )}
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        {verificationPending && <Link to={`/verify-email${returnPath ? `?next=${encodeURIComponent(returnPath)}` : ""}`}>Request another verification link</Link>}
        <button className="button" disabled={busy}>
          {t(busy ? "Please wait…" : register ? "Create account" : "Log in")}{" "}
          <ArrowRight size={17} />
        </button>
        <p>
          {t(register ? "Already have an account?" : "New here?")}{" "}
          <Link className="underlink" to={`${register ? "/login" : "/register"}${returnPath ? `?next=${encodeURIComponent(returnPath)}` : ""}`}>
            {t(register ? "Log in" : "Create an account")}
          </Link>
        </p>
        {!register && <p><Link className="underlink" to="/forgot-password">{t("Forgot password?")}</Link></p>}
        {!register && error.toLowerCase().includes("verify your email") && <p><Link className="underlink" to={`/verify-email${returnPath ? `?next=${encodeURIComponent(returnPath)}` : ""}`}>Resend verification link</Link></p>}
        <div className="google-auth-separator">Or use your Google account</div>
        <GoogleButton onSession={(data) => { setSession(data); navigate(returnPath || roleHome(data.user.role)); }} />
        <small>
          Existing professional accounts must first link Google while signed in. Google sign-in needs internet.
        </small>
        <small>
          Sessions use a short-lived access token and a rotating HttpOnly
          refresh cookie.
        </small>
      </form>
    </section>
  );
}
function GoogleLinkPanel() {
  const [message, setMessage] = useState('');
  return <section className="panel" style={{ padding: '1rem', marginBlock: '1rem' }}>
    <h2>Google sign-in</h2>
    <p>Link a Google account with the same email as this account. This does not change your role.</p>
    <GoogleButton link onSession={(result) => setMessage(result.message)} />
    {message && <p role="status">{message}</p>}
  </section>;
}
function Workspace({ role }) {
  const { session, setSession, loading } = useContext(Auth);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const main = useRef(null);
  const toggle = useRef(null);
  useEffect(() => {
    main.current?.focus();
  }, [pathname]);
  useEffect(() => {
    const close = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    if (open) window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  if (loading) return <p role="status">Loading session…</p>;
  if (!session) return <Navigate to="/login" replace />;
  if (session.user.role !== role)
    return <Navigate to={roleHome(session.user.role)} replace />;
  const items = workspaceNavigation(role);
  const base = roleHome(role);
  const roleLabel =
    role === "admin"
      ? "Platform admin"
      : role === "professional"
        ? "Professional"
        : "Customer";
  return (
    <><ConnectionBanner />{session.user.role === "customer" && session.user.emailVerified === false && <div className="container notice" role="status">Email verification is still pending. You can use your customer account now; verify your address after approved email delivery is configured to enable reliable recovery messages.</div>}<div className="studio-workspace-top"><Brand /><nav aria-label="Site shortcuts"><Link to="/">{t("Home")}</Link><Link to="/#services-preview">{t("Services")}</Link><Link className="studio-nav-cta" to={base}>{t("My account")} <ArrowUpRight size={14}/></Link><button onClick={() => setSession(null)}>{t("Sign out")}</button><LanguageSwitcher /></nav></div><div className="admin-layout workspace">
      <aside
        id="workspace-navigation"
        className={open ? "admin-sidebar expanded" : "admin-sidebar"}
      >
        <Link className="workspace-brand" to={base}>
          <span className="studio-logo-mini">S.</span>
          <span>Salon Studio<small>{roleLabel} workspace</small></span>
        </Link>
        <p className="studio-sidebar-label">YOUR {role === "customer" ? "SPACE" : role === "professional" ? "BUSINESS" : "PLATFORM"}</p>
        <nav
          aria-label={
            role === "customer"
              ? "Customer navigation"
              : role === "admin"
                ? "Admin navigation"
                : "Professional navigation"
          }
        >
          {items.map(([path, label, Icon]) => (
            <NavLink
              end={!path}
              key={path}
              to={base + (path ? "/" + path : "")}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} aria-hidden="true" />
              {t(label)}
            </NavLink>
          ))}
          {role === "customer" && (
            <details className="workspace-more">
              <summary>{t("More")}</summary>
              {customerItems.filter(([path]) => !customerNavigation.includes(path)).map(([path, label, Icon]) => (
                <NavLink key={path} to={base + "/" + path} onClick={() => setOpen(false)}>
                  <Icon size={18} aria-hidden="true" />{t(label)}
                </NavLink>
              ))}
            </details>
          )}
          {role !== "customer" && (
            <details className="workspace-more">
              <summary>{t("More tools")}</summary>
              {(role === "admin" ? platformItems : professionalItems)
                .filter(([path]) => !items.some(([visible]) => visible === path))
                .map(([path, label, Icon]) => (
                  <NavLink key={path} to={base + "/" + path} onClick={() => setOpen(false)}>
                    <Icon size={18} aria-hidden="true" />{t(label)}
                  </NavLink>
                ))}
            </details>
          )}
        </nav>
        <div className="sidebar-footer">
          <Link to="/">
            View public website <ArrowUpRight size={16} />
          </Link>
          <button onClick={() => setSession(null)}>
            <LogOut size={16} />
            {t("Log out")}
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-top">
          <button
            ref={toggle}
            className="menu-toggle"
            aria-label="Toggle navigation"
            aria-controls="workspace-navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <span className="workspace-role">{roleLabel} workspace</span>
          <Link className="workspace-user" to={base + "/profile"}>
            <UserRound size={18} />
            <span>{session.user.name}</span>
          </Link>
        </header>
        <main id="main" tabIndex={-1} ref={main}>
          <Outlet />
        </main>
      </div>
    </div></>
  );
}
function WorkspacePage() {
  const { pathname } = useLocation();
  const { session } = useContext(Auth);
  const { t } = useLanguage();
  const key = pathname.split("/")[2] || "";
  const isAdmin = session.user.role === "admin";
  const isCustomer = session.user.role === "customer";
  const items = isAdmin
    ? platformItems
    : isCustomer
      ? customerItems
      : professionalItems;
  const title = items.find(([p]) => p === key)?.[1];
  if (!title)
    return (
      <section className="admin-content">
        <h1>Access restricted</h1>
        <p>This section is not available to your role.</p>
      </section>
    );
  const component = isCustomer ? (
    key === "" ? (
      <CustomerOverview />
    ) : key === "appointments" ? (
      <Appointments key="current" />
    ) : key === "history" ? (
      <Appointments key="history" initialStatus="completed" />
    ) : key === "payments" ? (
      <Payments />
    ) : key === "professionals" ? (
      <ProfessionalDirectory />
    ) : key === "book" ? (
      <Booking embedded />
    ) : key === "profile" ? (
      <><Profile /><GoogleLinkPanel /></>
    ) : (
      <NotificationHistory />
    )
  ) : isAdmin ? (
    key === "" ? (
      <PlatformOverview />
    ) : key === "accounts" ? (
      <PlatformAccounts />
    ) : key === "settings" ? (
      <PlatformSettingsPage />
    ) : key === "profile" ? (
      <Profile />
    ) : key === "audit" ? (
      <AuditHistory />
    ) : (
      <NotificationHistory />
    )
  ) : key === "" ? (
    <ProfessionalOverview />
  ) : key === "book" ? (
    <Booking embedded />
  ) : key === "availability" ? (
    <ProfessionalAvailability />
  ) : key === "advertisements" ? (
    <AdvertisementManagement />
  ) : key === "appointments" ? (
    <ProfessionalAppointments />
  ) : key === "pending-confirmations" ? (
    <ProfessionalAppointments initialTab="pending_confirmation" />
  ) : ["customers", "services", "expenses"].includes(key) ? (
    <Manage key={key} kind={key} />
  ) : key === "payments" ? (
    <Payments key="payments" />
  ) : key === "pending-confirmations" ? (
    <Payments key="pending" pending />
  ) : key === "reports" ? (
    <Reports />
  ) : key === "settings" ? (
    <>
      <ProfessionalAvailability />
      <SettingsPage />
    </>
  ) : key === "profile" ? (
    <><Profile /><GoogleLinkPanel /></>
  ) : key === "audit" ? (
    <AuditHistory />
  ) : (
    <NotificationHistory />
  );
  return (
    <section className="admin-content">
      <p className="eyebrow">
        {isAdmin
          ? "PLATFORM ADMINISTRATION"
          : isCustomer
            ? "YOUR ACCOUNT"
            : "YOUR PROFESSIONAL BUSINESS"}
      </p>
      <h1>{t(title)}</h1>
      {component}
    </section>
  );
}
function NotFound() {
  return (
    <section className="container section">
      <PageTitle label="404" title="A little off course." />
      <Link className="button" to="/">
        Back home <ArrowRight size={18} />
      </Link>
    </section>
  );
}
function App() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <LanguageProvider>
      <Providers>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route
              path="professionals/:id"
              element={<ProfessionalPublicProfile />}
            />
            <Route path="about" element={<Navigate to="/#home" replace />} />
            <Route path="services" element={<Services />} />
            <Route path="services/:id" element={<ServiceDetail />} />
            <Route path="book" element={<BookingPage />} />
            <Route path="contact" element={<Contact />} />
            <Route path="login" element={<AuthPage key="login" />} />
            <Route
              path="register"
              element={<AuthPage key="register" register />}
            />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="professional-setup" element={<ProfessionalSetupPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="account" element={<Workspace role="customer" />}>
            <Route index element={<WorkspacePage />} />
            <Route path=":section" element={<WorkspacePage />} />
          </Route>
          <Route path="admin" element={<Workspace role="admin" />}>
            <Route index element={<WorkspacePage />} />
            <Route path=":section" element={<WorkspacePage />} />
          </Route>
          <Route
            path="professional"
            element={<Workspace role="professional" />}
          >
            <Route index element={<WorkspacePage />} />
            <Route path=":section" element={<WorkspacePage />} />
          </Route>
        </Routes>
      </Providers>
      </LanguageProvider>
    </BrowserRouter>
  );
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
