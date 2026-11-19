import {
  publicAdvertisementRoutes,
  privateAdvertisementRoutes,
} from "./advertisements.js";
import {
  publicBusinessMediaRoutes,
  privateBusinessMediaRoutes,
} from "./business-media.js";
import express from "express";
import { randomBytes } from "node:crypto";
import { verifyGoogleIdToken } from "./google-auth.js";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import {
  User,
  Session,
  AuthChallenge,
  Provision,
  Service,
  Appointment,
  Payment,
  Expense,
  BusinessSettings,
  ProfessionalProfile,
  ProfessionalCustomer,
  GuestCustomer,
  PlatformSettings,
  Notification,
  Audit,
} from "./models.js";
import {
  authenticate,
  allowRoles,
  publicUser,
  startSession,
  rotateSession,
  clearCookie,
  refreshCookie,
  hashToken,
  requireOrigin,
} from "./auth.js";
import * as v from "./validation.js";
import {
  settings,
  fail,
  tx,
  audit,
  notify,
  reserve,
  availability,
  changeAppointment,
  recordPayment,
  reviewPayment,
  financialSummary,
  expireHolds,
} from "./business.js";
import {
  businessScope,
  appointmentScope,
  platformSettings,
  publishedProfessionalIds,
  publicBusiness,
  publicContentFilter,
  publicPlatformSettings,
  paymentScope,
} from "./tenancy.js";
import { createProfessionalAccount } from "./accounts.js";
import { createChallenge, consumeChallenge, sendAccountEmail } from "./account-email.js";
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function list(model, query, req, populate) {
  const { page, limit, search } = v.pageQuery.parse(req.query);
  if (search) {
    const field =
      model === User
        ? "name"
        : model === Appointment
          ? "reference"
          : model === Service
            ? "name"
            : model === Payment
              ? "reference"
              : model === Notification
                ? "title"
                : model === Audit
                  ? "action"
                  : "description";
    if (model === Appointment) {
      const matchingCustomers = await User.find({
        role: "customer",
        $or: [
          { name: { $regex: escapeRegex(search), $options: "i" } },
          { email: { $regex: escapeRegex(search), $options: "i" } },
          { phone: { $regex: escapeRegex(search), $options: "i" } },
          { whatsappNumber: { $regex: escapeRegex(search), $options: "i" } },
        ],
      }).distinct("_id");
      query.$or = [
        { reference: { $regex: escapeRegex(search), $options: "i" } },
        { serviceName: { $regex: escapeRegex(search), $options: "i" } },
        { customer: { $in: matchingCustomers } },
        { "guestCustomer.name": { $regex: escapeRegex(search), $options: "i" } },
        { "guestCustomer.phone": { $regex: escapeRegex(search), $options: "i" } },
      ];
    } else if (model === User)
      query.$or = [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { email: { $regex: escapeRegex(search), $options: "i" } },
      ];
    else query[field] = { $regex: escapeRegex(search), $options: "i" };
  }
  let cursor = model
    .find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  if (populate) cursor = cursor.populate(populate);
  return {
    items: await cursor,
    total: await model.countDocuments(query),
    page,
    limit,
  };
}
export function createApp(config) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  // Cookies are only accepted on refresh/logout; all application writes require a bearer token.
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 1000,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.get("/api/health", (_req, res) =>
    res
      .status(
        mongoose.connection.readyState === 1 || config.NODE_ENV === "test"
          ? 200
          : 503,
      )
      .json({
        status:
          mongoose.connection.readyState === 1 ? "ok" : "database_unavailable",
        timeZone: "Africa/Maseru",
        currency: "LSL",
        emailMode: config.EMAIL_MODE || "safe",
      }),
  );
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: config.NODE_ENV === "test" ? 1000 : 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(
    ["/api/auth/login", "/api/auth/register", "/api/auth/provision-admin", "/api/auth/google", "/api/auth/google/link", "/api/auth/verify-email", "/api/auth/resend-verification", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/professional-setup"],
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: config.NODE_ENV === "test" ? 1000 : 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.post("/api/auth/register", async (req, res) => {
    const data = v.register.parse(req.body);
    const { token, challenge } = await tx(async (session) => {
      const [user] = await User.create([{
        ...data,
        role: "customer",
        emailVerified: false,
        verificationVersion: 1,
      }], { session });
      const challenge = await createChallenge(user, "email_verification", session);
      return { user, ...challenge };
    });
    const user = await User.findById(challenge.user);
    const deliveryStatus = await sendAccountEmail(config, user, "email_verification", token, config.EMAIL_TRANSPORT_FACTORY);
    res.status(201).json({
      message: deliveryStatus === "sent"
        ? "Account created. Check your email and follow the verification link before signing in."
        : "Account created. Email delivery is not configured or failed, so customer sign-in remains available in safe mode; request verification again after approved email delivery is configured.",
      deliveryStatus,
    });
  });
  app.post("/api/auth/login", async (req, res) => {
    const data = v.login.parse(req.body);
    const user = await User.findOne({ email: data.email }).select("+password");
    if (!user?.active || !(await user.comparePassword(data.password)))
      return res.status(401).json({ message: "Invalid email or password." });
      if (user.setupPending === true)
        return res.status(403).json({ message: "Complete the one-time secure setup link sent to your email before signing in." });
    if (user.emailVerified === false && (user.role !== "customer" || config.CUSTOMER_EMAIL_VERIFICATION_REQUIRED === "yes" || config.EMAIL_MODE === "smtp"))
      return res.status(403).json({ message: "Verify your email address before signing in. You can request a new verification link." });
    res.json(await startSession(user, res, config));
  });
  app.post("/api/auth/verify-email", requireOrigin(config), async (req, res) => {
    const { token } = z.object({ token: z.string().min(32).max(200) }).strict().parse(req.body);
    const user = await tx(async (session) => {
      const challenge = await consumeChallenge(token, "email_verification", session);
      if (!challenge?.user) fail(400, "Verification link is invalid or expired. Request a new link.");
      const account = await User.findOneAndUpdate(
        { _id: challenge.user, active: true, emailVerified: false },
        { $set: { emailVerified: true, emailVerifiedAt: new Date() }, $inc: { verificationVersion: 1 } },
        { new: true, session },
      );
      if (!account) fail(409, "Email is already verified or the account is unavailable.");
      return account;
    });
    res.json({ message: "Email verified. You can now sign in.", email: user.email });
  });
  app.post("/api/auth/resend-verification", requireOrigin(config), async (req, res) => {
    const { email } = z.object({ email: v.email }).strict().parse(req.body);
    const user = await User.findOne({ email, active: true });
    if (user && user.emailVerified === false) {
      const { token } = await createChallenge(user, "email_verification");
      await sendAccountEmail(config, user, "email_verification", token, config.EMAIL_TRANSPORT_FACTORY);
    }
    res.status(202).json({ message: "If this account needs verification, a new link will be sent when email delivery is available." });
  });
  app.post("/api/auth/forgot-password", requireOrigin(config), async (req, res) => {
    const { email } = z.object({ email: v.email }).strict().parse(req.body);
    const user = await User.findOne({ email, active: true });
    if (user) {
      const { token } = await createChallenge(user, "password_reset");
      await sendAccountEmail(config, user, "password_reset", token, config.EMAIL_TRANSPORT_FACTORY);
    }
    res.status(202).json({ message: "If an active account uses that email, password reset instructions will be sent when email delivery is available." });
  });
  app.post("/api/auth/reset-password", requireOrigin(config), async (req, res) => {
    const { token, password } = z.object({ token: z.string().min(32).max(200), password: v.password }).strict().parse(req.body);
    await tx(async (session) => {
      const challenge = await consumeChallenge(token, "password_reset", session);
      if (!challenge?.user) fail(400, "Password reset link is invalid or expired. Request another link.");
      const user = await User.findOne({ _id: challenge.user, active: true }).session(session);
      if (!user) fail(400, "Password reset link is invalid or expired.");
      user.password = password;
      user.tokenVersion += 1;
      user.passwordResetVersion += 1;
      await user.save({ session });
      await Session.deleteMany({ user: user._id }, { session });
    });
    res.json({ message: "Password updated. Sign in with your new password." });
  });
  app.post("/api/auth/professional-setup", requireOrigin(config), async (req, res) => {
    const data = z.object({
      token: z.string().min(32).max(200),
      name: v.personName,
      password: v.password,
    }).strict().parse(req.body);
    const user = await tx(async (session) => {
      const challenge = await consumeChallenge(data.token, "professional_setup", session);
      if (!challenge?.user) fail(400, "This professional invitation is invalid, expired, or already used. Ask the administrator to resend it.");
      const account = await User.findOne({
        _id: challenge.user,
        role: "professional",
        active: true,
        setupPending: true,
        emailVerified: false,
      }).select("+password").session(session);
      if (!account) fail(409, "This professional account is no longer awaiting setup.");
      account.name = data.name;
      account.password = data.password;
      account.setupPending = false;
      account.emailVerified = true;
      account.emailVerifiedAt = new Date();
      account.tokenVersion++;
      await account.save({ session });
      await audit(account._id, "professional.setup_completed", "User", account._id, "One-time email-verified account setup", session);
      return account;
    });
    res.json(await startSession(user, res, config));
  });
  app.post("/api/auth/google/nonce", requireOrigin(config), async (_req, res) => {
    if (!config.GOOGLE_CLIENT_ID) return res.status(404).json({ message: "Google login is not configured." });
    const { token } = await createChallenge(undefined, "google_nonce");
    res.json({ nonce: token });
  });
  // Google sign-in never grants elevated roles. Existing email accounts must link
  // from an authenticated session first, preventing email-based account takeover.
  app.post("/api/auth/google", requireOrigin(config), async (req, res) => {
    if (!config.GOOGLE_CLIENT_ID) return res.status(404).json({ message: "Google login is not configured." });
    const { credential } = z.object({ credential: z.string().min(50).max(8192) }).strict().parse(req.body);
    let identity;
    try { identity = await verifyGoogleIdToken(credential, config.GOOGLE_CLIENT_ID); }
    catch { return res.status(401).json({ message: "Google authentication failed. Please try again online." }); }
    if (!(await consumeChallenge(identity.nonce, "google_nonce")))
      return res.status(401).json({ message: "Google sign-in expired. Start again." });
    let user = await User.findOne({ googleSub: identity.sub });
    if (user && user.role !== "customer")
      return res.status(403).json({ message: "Sign in to this professional or administrator account with its password, then link Google from the authenticated profile." });
    if (user && user.email !== identity.email)
      return res.status(409).json({ message: "Google account email no longer matches the linked account." });
    if (user && user.emailVerified === false) {
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      await user.save();
    }
    if (!user) {
      const emailAccount = await User.findOne({ email: identity.email });
      if (emailAccount)
        return res.status(emailAccount.role === "customer" ? 409 : 403).json({
          message: emailAccount.role === "customer"
            ? "An account already uses this email. Sign in with its password, then link Google from your profile."
            : "Google sign-in cannot create or grant a professional or administrator session. Sign in with the existing account and use its approved recovery options.",
        });
    }
    if (!user) {
      try {
        const validName = v.personName.safeParse(identity.name);
        user = await User.create({ name: validName.success ? validName.data : "Google Customer", email: identity.email,
          password: randomBytes(48).toString('hex'), googleSub: identity.sub, role: 'customer', emailVerified: true, emailVerifiedAt: new Date() });
      } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: "Account changed during Google sign-in. Please try again." });
        throw error;
      }
    }
    if (!user.active) return res.status(403).json({ message: "Account disabled." });
    res.json(await startSession(user, res, config));
  });
  app.post("/api/auth/google/link", requireOrigin(config), authenticate(config.JWT_SECRET, config), async (req, res) => {
    if (!config.GOOGLE_CLIENT_ID) return res.status(404).json({ message: "Google login is not configured." });
    if (!['professional', 'customer'].includes(req.user.role)) return res.status(403).json({ message: "Google linking is unavailable for this role." });
    const { credential } = z.object({ credential: z.string().min(50).max(8192) }).strict().parse(req.body);
    let identity;
    try { identity = await verifyGoogleIdToken(credential, config.GOOGLE_CLIENT_ID); }
    catch { return res.status(401).json({ message: "Google authentication failed." }); }
    if (!(await consumeChallenge(identity.nonce, "google_nonce")))
      return res.status(401).json({ message: "Google sign-in expired. Start again." });
    if (identity.email !== req.user.email)
      return res.status(403).json({ message: "Google email must match the account email." });
    if (req.user.googleSub && req.user.googleSub !== identity.sub)
      return res.status(409).json({ message: "A different Google account is already linked." });
    try {
      await User.updateOne({ _id: req.user._id, active: true }, { $set: { googleSub: identity.sub, emailVerified: true, emailVerifiedAt: new Date() } });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: "Google account is already linked elsewhere." });
      throw error;
    }
    res.json({ message: "Google account linked. You can now sign in with Google." });
  });
  app.post("/api/auth/refresh", requireOrigin(config), (req, res) =>
    rotateSession(req, res, config),
  );
  app.post("/api/auth/logout", requireOrigin(config), async (req, res) => {
    await Session.deleteOne({ tokenHash: hashToken(refreshCookie(req)) });
    clearCookie(res, config);
    res.json({ message: "Logged out." });
  });
  app.post(
    "/api/auth/provision-admin",
    requireOrigin(config),
    async (req, res) => {
      if (!config.ADMIN_SETUP_TOKEN)
        return res.status(404).json({ message: "Not found." });
      const data = v.register
        .extend({ setupToken: z.string().min(32).max(200) })
        .strict()
        .parse(req.body);
      const expected = Buffer.from(config.ADMIN_SETUP_TOKEN),
        actual = Buffer.from(data.setupToken);
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      )
        fail(403, "Invalid setup token.");
      const user = await tx(async (session) => {
        if (
          (await Provision.exists({ _id: "initial-admin" }).session(session)) ||
          (await User.exists({ role: "admin" }).session(session))
        )
          fail(409, "Initial admin already provisioned.");
        const { setupToken, ...fields } = data;
        const [u] = await User.create([{
          ...fields,
          role: "admin",
          emailVerified: config.NODE_ENV === "test",
        }], {
          session,
        });
        await Provision.create([{ _id: "initial-admin", admin: u._id }], {
          session,
        });
        await audit(
          u._id,
          "admin.provisioned",
          "User",
          u._id,
          "One-time platform setup",
          session,
        );
        return u;
      });
      if (user.emailVerified === false) {
        const { token } = await createChallenge(user, "email_verification");
        const deliveryStatus = await sendAccountEmail(config, user, "email_verification", token, config.EMAIL_TRANSPORT_FACTORY);
        return res.status(201).json({
          message: "Administrator created. Verify the configured email address before signing in.",
          emailDeliveryStatus: deliveryStatus,
        });
      }
      res.status(201).json(await startSession(user, res, config));
    },
  );
  app.post("/api/auth/provision-owner", (_req, res) =>
    res.status(410).json({ message: "Legacy owner provisioning is disabled." }),
  );
  app.get("/api/public/settings", async (_req, res) =>
    res.json(publicPlatformSettings(await platformSettings())),
  );
  app.get("/api/public/professionals", async (_req, res) => {
    const ids = await publishedProfessionalIds();
    const profiles = await ProfessionalProfile.find({
      professional: { $in: ids },
      published: true,
    }).select("professional salonName photo");
    const photos = new Map(
      profiles.map((profile) => [
        String(profile.professional),
        profile.photo
          ? `/api/public/professionals/${profile.professional}/photo`
          : null,
      ]),
    );
    res.json({
      items: profiles.map((p) => ({
        ...publicBusiness(p),
        _id: p.professional,
        name: p.salonName,
        photoUrl: photos.get(String(p.professional)) || null,
      })),
    });
  });
  app.get("/api/public/professionals/:id", async (req, res) => {
    const id = v.parseId(req.params.id);
    const ids = await publishedProfessionalIds();
    if (!ids.some((value) => String(value) === id))
      fail(404, "Professional not found.");
    res.json(
      publicBusiness(
        await ProfessionalProfile.findOne({
          professional: id,
          published: true,
        }),
      ),
    );
  });
  app.get("/api/public/services", async (req, res) => {
    const ids = await publishedProfessionalIds();
    const query = { active: true, ...publicContentFilter(), professional: { $in: ids } };
    if (req.query.professional) {
      const id = v.parseId(req.query.professional);
      query.professional = { $in: ids.filter((value) => String(value) === id) };
    }
    const result = await list(Service, query, req);
    const profiles = await ProfessionalProfile.find({
      professional: { $in: ids },
      published: true,
    }).select("professional salonName");
    const names = new Map(
      profiles.map((p) => [String(p.professional), p.salonName]),
    );
    res.set("Cache-Control", "no-store").json({
      ...result,
      items: result.items.map((item) => ({
        ...item.toObject(),
        imageUrl: item.image
          ? `/api/public/services/${item._id}/image`
          : item.imageUrl,
        professionalName: names.get(String(item.professional)),
      })),
    });
  });
  app.get("/api/public/availability", async (req, res) => {
    const query = z
      .object({ service: v.id, professional: v.id, date: z.iso.date() })
      .strict()
      .parse(req.query);
    const ids = await publishedProfessionalIds();
    const service = await Service.findOne({
      _id: query.service,
      active: true,
      ...publicContentFilter(),
      professional: { $in: ids.filter((value) => String(value) === query.professional) },
    });
    if (!service) fail(404, "Service or professional unavailable.");
    res.json({
      slots: await availability(query.service, query.professional, query.date),
    });
  });
  publicAdvertisementRoutes(app);
  publicBusinessMediaRoutes(app);
  app.use("/api", authenticate(config.JWT_SECRET, config));
  privateAdvertisementRoutes(app);
  privateBusinessMediaRoutes(app);
  const admin = allowRoles("admin"),
    professional = allowRoles("professional"),
    businessOrCustomer = allowRoles("professional", "customer");
  app.get("/api/auth/me", (req, res) =>
    res.json({ user: publicUser(req.user) }),
  );
  app.patch("/api/profile", async (req, res) => {
    Object.assign(req.user, v.profile.parse(req.body));
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  });
  app.post("/api/profile/password", async (req, res) => {
    const data = z
      .object({ currentPassword: z.string().max(200), password: v.password })
      .strict()
      .parse(req.body);
    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(data.currentPassword)))
      fail(400, "Current password is incorrect.");
    user.password = data.password;
    user.tokenVersion++;
    await user.save();
    await Session.deleteMany({ user: user._id });
    clearCookie(res, config);
    res.json({ message: "Password changed. Sign in again." });
  });

  // Platform administration deliberately has no private business/financial joins.
  app.get("/api/admin/overview", admin, async (_req, res) =>
    res.json({
      professionals: await User.countDocuments({ role: "professional" }),
      customers: await User.countDocuments({ role: "customer" }),
      admins: await User.countDocuments({ role: "admin" }),
    }),
  );
  app.get("/api/admin/accounts", admin, async (req, res) => {
    const { page, limit, search } = v.pageQuery.parse(req.query);
    const query = { role: { $in: ["admin", "professional", "customer"] } };
    if (search)
      query.$or = [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { email: { $regex: escapeRegex(search), $options: "i" } },
      ];
    res.json({
      items: await User.find(query)
        .select("name email phone role active setupPending createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      total: await User.countDocuments(query),
      page,
      limit,
    });
  });
  app.post("/api/admin/professionals", admin, async (req, res) => {
    const data = v.professionalAccount.parse(req.body);
    const user = await createProfessionalAccount(
      { ...data, emailVerified: config.NODE_ENV === "test" },
      req.user,
    );
    let deliveryStatus = "not_required";
    if (user.emailVerified === false) {
      const { token } = await createChallenge(user, "email_verification");
      deliveryStatus = await sendAccountEmail(config, user, "email_verification", token, config.EMAIL_TRANSPORT_FACTORY);
    }
    res.status(201).json({ ...publicUser(user), emailDeliveryStatus: deliveryStatus });
  });
  const professionalInvitationLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: config.NODE_ENV === "test" ? 100 : 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Professional invitation limit reached. Try again later." },
  });
  app.post("/api/admin/professional-invitations", admin, professionalInvitationLimit, async (req, res) => {
    const { email } = z.object({ email: v.email }).strict().parse(req.body);
    if (await User.exists({ email })) fail(409, "An account with this email already exists. Sign in or use the existing account-recovery process.");
    const user = await tx(async (session) => {
      const [created] = await User.create([{
        name: "Professional",
        email,
        password: randomBytes(48).toString("hex"),
        role: "professional",
        createdBy: req.user._id,
        emailVerified: false,
        setupPending: true,
      }], { session });
      await ProfessionalProfile.create([{
        professional: created._id,
        salonName: "Business setup required",
        published: false,
        whatsappNumber: "",
      }], { session });
      await audit(req.user._id, "professional.invited", "User", created._id, "Professional account invitation", session);
      return created;
    });
    const { token } = await createChallenge(user, "professional_setup");
    const deliveryStatus = await sendAccountEmail(config, user, "professional_setup", token, config.EMAIL_TRANSPORT_FACTORY);
    res.status(201).json({
      message: deliveryStatus === "sent"
        ? "Invitation sent. The professional must follow the one-time email link within 24 hours, verify control of the address, and set a new password."
        : "Invitation account prepared but no email was sent. Configure approved SMTP, then ask an admin to resend the invitation. Do not share a password or setup link out-of-band.",
      emailDeliveryStatus: deliveryStatus,
      account: { id: String(user._id), email: user.email, role: user.role, emailVerified: false, setupPending: true },
    });
  });
  app.post("/api/admin/professional-invitations/:id/resend", admin, professionalInvitationLimit, async (req, res) => {
    z.object({}).strict().parse(req.body || {});
    const user = await User.findOne({
      _id: v.parseId(req.params.id),
      role: "professional",
      active: true,
      setupPending: true,
      emailVerified: false,
    });
    if (!user) fail(404, "Pending professional invitation not found.");
    const { token } = await createChallenge(user, "professional_setup");
    const deliveryStatus = await sendAccountEmail(config, user, "professional_setup", token, config.EMAIL_TRANSPORT_FACTORY);
    res.status(202).json({
      message: deliveryStatus === "sent"
        ? "A new one-time invitation was sent; the prior invitation is no longer valid."
        : "No email was sent. Configure approved SMTP before resending; do not share a setup link out-of-band.",
      emailDeliveryStatus: deliveryStatus,
    });
  });
  app.patch("/api/admin/accounts/:id", admin, async (req, res) => {
    const id = v.parseId(req.params.id),
      data = v.accountStatus.parse(req.body);
    if (id === String(req.user._id))
      fail(409, "Cannot deactivate your current admin account.");
    const user = await tx(async (session) => {
      const u = await User.findOne({
        _id: id,
        role: { $in: ["admin", "professional", "customer"] },
      }).session(session);
      if (!u) fail(404, "Account not found.");
      u.active = data.active;
      u.tokenVersion++;
      await u.save({ session });
      await audit(
        req.user._id,
        "account.status_changed",
        "User",
        u._id,
        data.active ? "Activated" : "Deactivated",
        session,
      );
      return u;
    });
    res.json({ ...publicUser(user), active: user.active });
  });
  app.get("/api/admin/settings", admin, async (_req, res) =>
    res.json(await platformSettings()),
  );
  app.put("/api/admin/settings", admin, async (req, res) => {
    const data = v.platformSettings.parse(req.body);
    await platformSettings();
    const item = await tx(async (session) => {
      const item = await PlatformSettings.findOneAndUpdate(
        { key: "platform" },
        { $set: data },
        { new: true, runValidators: true, session },
      );
      await audit(
        req.user._id,
        "platform.settings_updated",
        "PlatformSettings",
        item._id,
        undefined,
        session,
      );
      return item;
    });
    res.json(item);
  });

  app.get("/api/professional/overview", professional, async (req, res) => {
    const scope = businessScope(req.user);
    await expireHolds();
    res.json({
      appointments: await Appointment.countDocuments(scope),
      customers: await ProfessionalCustomer.countDocuments(scope) + await GuestCustomer.countDocuments(scope),
      pendingConfirmations: await Appointment.countDocuments({
        ...scope,
        status: "pending_confirmation",
      }),
      appointmentStatuses: Object.fromEntries(
        await Promise.all(
          Appointment.schema.path("status").enumValues.map(async (status) => [
            status,
            await Appointment.countDocuments({ ...scope, status }),
          ]),
        ),
      ),
      upcoming: await Appointment.find({
        ...scope,
        status: "confirmed",
        startsAt: { $gte: new Date() },
      })
        .sort({ startsAt: 1 })
        .limit(10)
        .populate("customer", "name phone"),
    });
  });
  app.get(
    "/api/professional/availability/slots",
    professional,
    async (req, res) => {
      const query = z
        .object({ service: v.id, date: z.iso.date() })
        .strict()
        .parse(req.query);
      res.json({
        slots: await availability(query.service, req.user._id, query.date, {
          allowUnpublished: true,
        }),
      });
    },
  );
  app.get("/api/professional/settings", professional, async (req, res) => {
    const item = await settings(req.user._id);
    res.json({
      ...item.toObject(),
      photoUrl: item.photo
        ? `/api/public/professionals/${req.user._id}/photo`
        : null,
    });
  });
  app.put("/api/professional/settings", professional, async (req, res) => {
    const data = v.settings.parse(req.body);
    await settings(req.user._id);
    const item = await tx(async (session) => {
      const item = await ProfessionalProfile.findOne({
        professional: req.user._id,
      }).session(session);
      Object.assign(item, data);
      item.policyVersion = String(Number(item.policyVersion) + 1);
      await item.save({ session });
      await audit(
        req.user._id,
        "business.settings_updated",
        "ProfessionalProfile",
        item._id,
        undefined,
        session,
        req.user._id,
      );
      return item;
    });
    res.json(item);
  });
  app.put("/api/professional/availability", professional, async (req, res) => {
    Object.assign(req.user, v.availabilityProfile.parse(req.body));
    await req.user.save();
    res.json({
      weekdays: req.user.weekdays,
      workStart: req.user.workStart,
      workEnd: req.user.workEnd,
    });
  });
  app.get("/api/professional/availability", professional, (req, res) =>
    res.json({
      weekdays: req.user.weekdays,
      workStart: req.user.workStart,
      workEnd: req.user.workEnd,
    }),
  );
  // Old management endpoints have no compatibility privilege fallback.
  app.use(["/api/staff", "/api/settings"], (_req, res) =>
    res.status(410).json({
      message:
        "Legacy shared management endpoint disabled. Use role-specific settings/accounts.",
    }),
  );

  app.get("/api/appointments", businessOrCustomer, async (req, res) => {
    const scope = appointmentScope(req.user);
    await expireHolds();
    const dateRange = z
      .object({ from: z.iso.date().optional(), to: z.iso.date().optional() })
      .strict()
      .parse({ from: req.query.from, to: req.query.to });
    if (dateRange.from && dateRange.to && dateRange.from > dateRange.to)
      fail(400, "Start date must be on or before end date.");
    if (dateRange.from || dateRange.to) {
      scope.startsAt = {
        ...(dateRange.from
          ? { $gte: new Date(`${dateRange.from}T00:00:00+02:00`) }
          : {}),
        ...(dateRange.to
          ? {
              $lt: new Date(
                +new Date(`${dateRange.to}T00:00:00+02:00`) + 86400000,
              ),
            }
          : {}),
      };
    }
    if (req.query.status) {
      const requestedStatus = z
        .enum(Appointment.schema.path("status").enumValues)
        .parse(req.query.status);
      scope.status = requestedStatus === "confirmed"
        ? { $in: ["confirmed", "in_progress"] }
        : requestedStatus;
    }
    const result = await list(Appointment, scope, req, [
        { path: "customer", select: "name email phone whatsappNumber" },
        { path: "professional", select: "name" },
      ]);
    const ids = result.items.map((item) => item._id);
    const scopedPayments =
      req.user.role === "professional"
        ? businessScope(req.user)
        : await paymentScope(req.user);
    const payments = ids.length
      ? await Payment.find({
          ...scopedPayments,
          appointment: { $in: ids },
        })
          .sort({ createdAt: -1 })
          .select("appointment kind status amountLisente method verifiedAt")
          .lean()
      : [];
    const paymentByAppointment = new Map();
    for (const payment of payments) {
      if (payment.kind !== "booking_fee" || paymentByAppointment.has(String(payment.appointment))) continue;
      paymentByAppointment.set(String(payment.appointment), payment);
    }
    const professionalIds = [
      ...new Set(result.items.map((item) => String(item.professional?._id || item.professional))),
    ];
    const businessProfiles = await ProfessionalProfile.find({
      professional: { $in: professionalIds },
    }).select("professional salonName").lean();
    const businessNames = new Map(
      businessProfiles.map((profile) => [String(profile.professional), profile.salonName]),
    );
    res.json({
      ...result,
      items: result.items.map((item) => {
        const payment = paymentByAppointment.get(String(item._id));
        return {
          ...item.toObject(),
          customerWhatsAppNumber:
            item.customerWhatsAppNumber ||
            (req.user.role === "professional" ? "" : undefined),
          paymentStatus:
            payment?.status ||
            (item.status === "pending_confirmation"
              ? "awaiting_verification"
              : "awaiting_payment"),
          paymentAmountLisente: payment?.amountLisente,
          paymentMethod: payment?.method,
          paymentVerifiedAt: payment?.verifiedAt,
          professionalBusinessName: businessNames.get(
            String(item.professional?._id || item.professional),
          ),
        };
      }),
    });
  });
  app.post("/api/appointments", businessOrCustomer, async (req, res) =>
    res.status(201).json(await reserve(v.booking.parse(req.body), req.user)),
  );
  app.post(
    "/api/appointments/:id/action",
    businessOrCustomer,
    async (req, res) => {
      const input = z
        .discriminatedUnion("action", [
          z
            .object({
              action: z.literal("reschedule"),
              startsAt: z.iso.datetime({ offset: true }),
            })
            .strict(),
          z
            .object({
              action: z.enum(["cancel", "start", "complete", "no_show"]),
              reason: z.string().max(500).optional(),
            })
            .strict(),
        ])
        .parse(req.body);
      res.json(
        await changeAppointment(v.parseId(req.params.id), input, req.user),
      );
    },
  );
  app.get("/api/payments", businessOrCustomer, async (req, res) => {
    const query = await paymentScope(req.user);
    if (req.query.appointment)
      query.appointment = v.parseId(req.query.appointment);
    if (req.query.status)
      query.status = z
        .enum(Payment.schema.path("status").enumValues)
        .parse(req.query.status);
    res.json(
      await list(Payment, query, req, [
        { path: "appointment", select: "reference serviceName" },
        { path: "verifiedBy", select: "name" },
      ]),
    );
  });
  app.post("/api/payments", professional, async (req, res) =>
    res
      .status(201)
      .json(await recordPayment(v.payment.parse(req.body), req.user)),
  );
  app.post("/api/payments/:id/review", professional, async (req, res) => {
    const input = z
      .object({
        action: z.enum(["verify", "reject", "request_info"]),
        note: z.string().trim().min(3).max(500),
      })
      .strict()
      .parse(req.body);
    res.json(await reviewPayment(v.parseId(req.params.id), input, req.user));
  });
  app.get("/api/customers", professional, async (req, res) => {
    const relations = await ProfessionalCustomer.find(
      businessScope(req.user),
    ).select("customer");
    const registered = await User.find({ _id: { $in: relations.map((r) => r.customer) }, role: "customer" }).select("name email phone");
    const guests = await GuestCustomer.find(businessScope(req.user)).select("name phone createdAt");
    const search = String(req.query.search || "").toLowerCase();
    const items = [...registered, ...guests.map(g => ({ _id: g._id, name: g.name, phone: g.phone, guest: true, createdAt: g.createdAt }))]
      .filter(c => !search || c.name.toLowerCase().includes(search) || (c.phone || "").includes(search));
    const { page, limit } = v.pageQuery.parse(req.query);
    res.json({ items: items.slice((page-1)*limit, page*limit), total: items.length, page, limit });
  });
  app.post("/api/customers", professional, async (req, res) => {
    const data = v.register.parse(req.body);
    const user = await tx(async (session) => {
      const [u] = await User.create([{ ...data, role: "customer" }], {
        session,
      });
      await ProfessionalCustomer.create(
        [{ professional: req.user._id, customer: u._id }],
        { session },
      );
      await audit(
        req.user._id,
        "customer.created",
        "User",
        u._id,
        undefined,
        session,
        req.user._id,
      );
      await notify(
        u._id,
        "Welcome",
        "Your customer account is ready.",
        session,
        req.user._id,
      );
      return u;
    });
    res.status(201).json(publicUser(user));
  });
  app.get("/api/services", professional, async (req, res) => {
    const result = await list(Service, businessScope(req.user), req);
    res.json({
      ...result,
      items: result.items.map((item) => ({
        ...item.toObject(),
        imageUrl: item.image
          ? `/api/public/services/${item._id}/image`
          : item.imageUrl,
      })),
    });
  });
  app.post("/api/services", professional, async (req, res) => {
    const data = v.service.parse(req.body);
    const item = await tx(async (session) => {
      const [item] = await Service.create(
        [{ ...data, professional: req.user._id }],
        { session },
      );
      await audit(
        req.user._id,
        "service.created",
        "Service",
        item._id,
        undefined,
        session,
        req.user._id,
      );
      return item;
    });
    res.status(201).json(item);
  });
  app.patch("/api/services/:id", professional, async (req, res) => {
    const data = v.service.parse(req.body);
    const item = await tx(async (session) => {
      const item = await Service.findOneAndUpdate(
        { _id: v.parseId(req.params.id), ...businessScope(req.user) },
        { $set: data },
        { new: true, runValidators: true, session },
      );
      if (!item) fail(404, "Service not found.");
      await audit(
        req.user._id,
        "service.updated",
        "Service",
        item._id,
        undefined,
        session,
        req.user._id,
      );
      return item;
    });
    res.json(item);
  });
  app.get("/api/expenses", professional, async (req, res) =>
    res.json(await list(Expense, businessScope(req.user), req)),
  );
  app.post("/api/expenses", professional, async (req, res) => {
    const data = v.expense.parse(req.body);
    const item = await tx(async (session) => {
      const [item] = await Expense.create(
        [{ ...data, professional: req.user._id, recordedBy: req.user._id }],
        { session },
      );
      await audit(
        req.user._id,
        "expense.recorded",
        "Expense",
        item._id,
        undefined,
        session,
        req.user._id,
      );
      return item;
    });
    res.status(201).json(item);
  });
  app.get("/api/reports", professional, async (req, res) => {
    const range = z
      .object({ from: z.iso.date().optional(), to: z.iso.date().optional() })
      .parse(req.query);
    if (range.from && range.to && range.from > range.to)
      fail(400, "Invalid date range.");
    const scope = businessScope(req.user),
      validPayments = await paymentScope(req.user),
      date = {
        ...(range.from
          ? { $gte: new Date(range.from + "T00:00:00+02:00") }
          : {}),
        ...(range.to
          ? {
              $lt: new Date(+new Date(range.to + "T00:00:00+02:00") + 86400000),
            }
          : {}),
      };
    const [payments, expenses, appointments] = await Promise.all([
      Payment.find({
        ...scope,
        ...validPayments,
        ...(Object.keys(date).length ? { verifiedAt: date } : {}),
      }).lean(),
      Expense.find({
        ...scope,
        ...(Object.keys(date).length ? { incurredAt: date } : {}),
      }).lean(),
      Appointment.find({
        ...scope,
        ...(Object.keys(date).length ? { startsAt: date } : {}),
      }).lean(),
    ]);
    const summary = financialSummary(payments, expenses, appointments);
    const allPaid = await Payment.find({
      ...scope,
      appointment: { $in: appointments.map((a) => a._id) },
      status: "paid",
    }).lean();
    const outstanding = appointments
      .filter((a) => !["cancelled", "no_show"].includes(a.status))
      .map((a) => ({
        reference: a.reference,
        outstandingLisente: Math.max(
          0,
          a.totalLisente -
            allPaid
              .filter((p) => String(p.appointment) === String(a._id))
              .reduce((n, p) => n + p.amountLisente, 0),
        ),
      }));
    const days = Object.create(null);
    for (const p of payments.filter((p) => p.status === "paid")) {
      const day = new Date(+p.verifiedAt + 7200000).toISOString().slice(0, 10);
      days[day] = (days[day] || 0) + p.amountLisente;
    }
    res.json({
      ...summary,
      outstanding,
      daily: Object.entries(days)
        .sort()
        .map(([date, receivedLisente]) => ({ date, receivedLisente })),
      basis:
        "Own professional business only. Received funds use verification dates; booked value uses appointment dates; outstanding uses lifetime receipts.",
    });
  });
  app.get("/api/notifications", async (req, res) => {
    const query =
      req.user.role === "professional"
        ? { professional: req.user._id, scope: "business" }
        : {
            recipient: req.user._id,
            scope: {
              $in:
                req.user.role === "admin"
                  ? ["platform", "personal"]
                  : ["personal", "business"],
            },
          };
    res.json(await list(Notification, query, req));
  });
  app.post("/api/notifications/:id/retry", professional, async (req, res) => {
    const item = await Notification.findOneAndUpdate(
      {
        _id: v.parseId(req.params.id),
        ...businessScope(req.user),
        scope: "business",
        status: "failed",
      },
      { $set: { status: "pending", attempts: 0 }, $unset: { lockedAt: 1 } },
      { new: true },
    );
    if (!item) fail(404, "Retryable notification not found.");
    res.json(item);
  });
  app.get("/api/audit", allowRoles("admin", "professional"), async (req, res) =>
    res.json(
      await list(
        Audit,
        req.user.role === "admin"
          ? { scope: "platform", professional: { $exists: false } }
          : { ...businessScope(req.user), scope: "business" },
        req,
        { path: "actor", select: "name" },
      ),
    ),
  );
  app.use((_req, res) =>
    res.status(404).json({ message: "Endpoint not found." }),
  );
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        message: "Please check the supplied fields.",
        errors: error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    if (error.code === 11000)
      return res.status(409).json({
        message:
          "Record already exists or selected time is no longer available.",
      });
    if (
      error instanceof mongoose.Error.ValidationError ||
      error instanceof mongoose.Error.CastError
    )
      return res.status(400).json({ message: "Invalid record data." });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ message: "Invalid JSON." });
    if (error.type === "entity.too.large")
      return res.status(413).json({ message: "Request too large." });
    if (error.status && error.status < 500)
      return res.status(error.status).json({ message: error.message });
    if (
      [
        "MongoNetworkError",
        "MongoServerSelectionError",
        "MongooseServerSelectionError",
      ].includes(error.name)
    )
      return res
        .status(503)
        .json({ message: "Database temporarily unavailable." });
    res.status(500).json({ message: "An unexpected error occurred." });
  });
  return app;
}
