import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import {
  User,
  Appointment,
  Payment,
  Service,
  Expense,
  BusinessSettings,
  Notification,
} from "../src/models.js";
import { issueToken, allowRoles } from "../src/auth.js";
import * as validation from "../src/validation.js";
import jwt from "jsonwebtoken";
import { readFile } from "node:fs/promises";
const secret = "a-random-test-only-secret-32-characters-long";
const app = createApp({
  CLIENT_ORIGIN: "http://localhost:3000",
  JWT_SECRET: secret,
  NODE_ENV: "test",
});
test("health exposes salon locale in test mode", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.timeZone, "Africa/Maseru");
  assert.equal(res.body.currency, "LSL");
  assert.ok(res.headers["x-content-type-options"]);
});
test("registration rejects privilege escalation and invalid passwords before database access", async () => {
  for (const body of [
    {
      name: "Test User",
      email: "user@example.test",
      password: "long-enough-password",
      role: "admin",
    },
    { name: "T", email: "invalid", password: "short" },
    {
      name: "Test User",
      email: "user@example.test",
      password: "😀".repeat(30),
    },
  ]) {
    const res = await request(app).post("/api/auth/register").send(body);
    assert.equal(res.status, 400);
  }
});
test("shared request validation normalizes identity/contact and rejects invalid booking/payment values", () => {
  const registered = validation.register.parse({
    name: "  O’Connor-Smith  ",
    email: "  CUSTOMER@EXAMPLE.TEST  ",
    password: "a-long-test-password",
    phone: "+266 60000001",
    whatsappNumber: "+266 60000002",
  });
  assert.equal(registered.name, "O’Connor-Smith");
  assert.equal(registered.email, "customer@example.test");
  assert.equal(registered.phone, "+26660000001");
  assert.equal(registered.whatsappNumber, "+26660000002");
  for (const name of ["A", "Customer 4", "<script>", "  "]) {
    assert.equal(validation.register.safeParse({
      name,
      email: "customer@example.test",
      password: "a-long-test-password",
    }).success, false);
  }
  assert.equal(validation.login.safeParse({ email: "bad-address", password: "x" }).success, false);
  assert.equal(validation.profile.safeParse({ name: "Customer Name", phone: "123", whatsappNumber: "" }).success, false);

  const ids = { service: "012345678901234567890123", professional: "123456789012345678901234" };
  const validBooking = {
    ...ids,
    startsAt: "2027-01-15T10:00:00+02:00",
    acceptPolicy: true,
    policyVersion: "1",
    notes: "",
  };
  assert.equal(validation.booking.safeParse(validBooking).success, true);
  assert.equal(validation.booking.safeParse({ ...validBooking, service: "not-an-id" }).success, false);
  assert.equal(validation.booking.safeParse({ ...validBooking, startsAt: "not-a-date" }).success, false);
  assert.equal(validation.booking.safeParse({ ...validBooking, acceptPolicy: false }).success, false);

  const payment = {
    appointment: "234567890123456789012345",
    amountLisente: 5000,
    method: "cash",
    reference: "RECEIPT-001",
    kind: "booking_fee",
  };
  assert.equal(validation.payment.safeParse(payment).success, true);
  for (const amountLisente of [0, -1, 1.5, 100000001])
    assert.equal(validation.payment.safeParse({ ...payment, amountLisente }).success, false);
  assert.equal(validation.payment.safeParse({ ...payment, method: "gateway" }).success, false);
});
test("protected routes reject missing, forged and expired tokens", async () => {
  for (const token of [
    null,
    "forged",
    jwt.sign({ sub: "012345678901234567890123" }, secret, { expiresIn: -1 }),
  ]) {
    let req = request(app).get("/api/admin/overview");
    if (token) req = req.set("Authorization", `Bearer ${token}`);
    assert.equal((await req).status, 401);
  }
});
test("role middleware permits authorised roles only", () => {
  let next = false;
  const res = {
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  allowRoles("admin")({ user: { role: "professional" } }, res, () => {
    next = true;
  });
  assert.equal(res.code, 403);
  assert.equal(next, false);
  allowRoles("admin", "professional")(
    { user: { role: "professional" } },
    res,
    () => {
      next = true;
    },
  );
  assert.equal(next, true);
});
test("tokens have bounded lifetime, issuer and audience", () => {
  const decoded = jwt.verify(
    issueToken({ _id: "012345678901234567890123" }, secret),
    secret,
    { issuer: "salon-api", audience: "salon-client" },
  );
  assert.equal(decoded.exp - decoded.iat, 900);
  assert.equal(decoded.role, undefined);
});
test("password hook hashes and verifies without plaintext storage", async () => {
  const user = new User({
    name: "Test",
    email: "test@example.test",
    password: "a-long-test-password",
  });
  await new Promise((resolve, reject) =>
    User.schema.s.hooks.execPre("save", user, [], (error) =>
      error ? reject(error) : resolve(),
    ),
  );
  assert.notEqual(user.password, "a-long-test-password");
  assert.equal(await user.comparePassword("a-long-test-password"), true);
  assert.equal(await user.comparePassword("incorrect"), false);
});
test("appointment interval must end after start; awaiting-payment is default", async () => {
  const id = "012345678901234567890123";
  const appointment = new Appointment({
    customer: id,
    professional: id,
    service: id,
    startsAt: new Date("2026-12-01T10:00:00Z"),
    endsAt: new Date("2026-12-01T09:00:00Z"),
    priceLisente: 10000,
    reference: "TEST",
    serviceName: "TEST",
    durationMinutes: 60,
    feeLisente: 1000,
    totalLisente: 10000,
    feeDeducted: true,
    policyVersion: "1",
    policyText: "Test policy",
    policyAcceptedAt: new Date(),
  });
  assert.equal(appointment.status, "awaiting_payment");
  await assert.rejects(appointment.validate(), /Must be after/);
});
test("payments require human verification metadata and integer lisente", async () => {
  const id = "012345678901234567890123";
  const payment = new Payment({
    appointment: id,
    professional: id,
    recordedBy: id,
    amountLisente: 10000,
    method: "cash",
    kind: "booking_fee",
    reference: "TEST-REF",
  });
  await payment.validate();
  assert.equal(payment.status, "awaiting_verification");
  payment.status = "paid";
  await assert.rejects(payment.validate(), /Manual verifier/);
  payment.verifiedBy = id;
  payment.verifiedAt = new Date();
  await payment.validate();
  payment.amountLisente = 1.5;
  await assert.rejects(payment.validate());
});
test("all seven models are registered", () => {
  assert.equal(
    [
      User,
      Service,
      Appointment,
      Payment,
      Expense,
      BusinessSettings,
      Notification,
    ].length,
    7,
  );
});
test("configuration fails closed for missing credentials", () => {
  assert.throws(() => loadConfig({}));
  assert.throws(() =>
    loadConfig({
      MONGODB_URI: "mongodb://localhost/test",
      JWT_SECRET: "short",
    }),
  );
});
test("offline worker caches only the shell and explicitly public display APIs", async () => {
  const worker = await readFile(new URL("../../client/public/sw.js", import.meta.url), "utf8");
  assert.match(worker, /offline\.html/);
  assert.match(worker, /PUBLIC_CACHE/);
  assert.match(worker, /isAllowedPublicData/);
  assert.match(worker, /authorization/i);
  for (const privateRoute of ["/api/auth/", "/api/appointments", "/api/payments", "/api/professional/", "/api/admin/", "/api/notifications"]) {
    assert.ok(!worker.includes(`'${privateRoute}'`), `${privateRoute} must never enter the public allowlist`);
  }
  assert.match(worker, /keys\.length > 100/);
  assert.match(worker, /not available offline yet/);
});
test("English and Sesotho language switcher uses centralized persistent preference", async () => {
  const [provider, ui] = await Promise.all([
    readFile(new URL("../../client/src/i18n.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../client/src/main.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(provider, /localStorage\.getItem\("salon-language"\)/);
  assert.match(provider, /localStorage\.setItem\("salon-language"/);
  for (const [english, sesotho] of [["Home", "Lehae"], ["Services", "Litšebeletso"], ["Appointments", "Lipehelo"], ["Cancel", "Hlakola"], ["Confirm", "Netefatsa"], ["Settings", "Litlhophiso"]]) {
    assert.ok(provider.includes(`"${english}": "${sesotho}"`), `${english} should have a centralized Sesotho translation`);
  }
  assert.match(ui, /<LanguageProvider>/);
  assert.match(ui, /<LanguageSwitcher\s*\/>/);
});
test("malformed JSON, unknown endpoints, and CORS are handled", async () => {
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send("{")
    ).status,
    400,
  );
  assert.equal((await request(app).get("/api/missing")).status, 401);
  const res = await request(app)
    .get("/api/health")
    .set("Origin", "https://other.example");
  assert.notEqual(
    res.headers["access-control-allow-origin"],
    "https://other.example",
  );
});
