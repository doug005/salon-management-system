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
import jwt from "jsonwebtoken";
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
