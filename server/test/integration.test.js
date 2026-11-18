import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import request from "supertest";
import { projectRoot } from "../scripts/local-db.js";
import * as models from "../src/models.js";
import { assessMigration } from "../src/migration.js";
import { createApp } from "../src/app.js";
import {
  User,
  Session,
  Provision,
  Service,
  Appointment,
  Slot,
  Payment,
  Expense,
  ProfessionalProfile,
  ProfessionalCustomer,
  PlatformSettings,
  Advertisement,
  Notification,
  Audit,
} from "../src/models.js";
import { settings, expireHolds, financialSummary } from "../src/business.js";
import { deliverPending, template } from "../src/notifications.js";
let db,
  app,
  admin,
  professional,
  otherProfessional,
  customer,
  other,
  service,
  business;
const origin = "http://localhost:3000",
  secret = "integration-test-secret-at-least-32-characters";
const account = (name) => ({
  name,
  email: name + "@example.test",
  password: "Synthetic-test-password-123",
});
const auth = (method, url, session) =>
  request(app)[method](url).set("Authorization", `Bearer ${session.token}`);
async function register(name) {
  const res = await request(app).post("/api/auth/register").send(account(name));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}
function futureSlot(offset = 0) {
  const d = new Date(Date.now() + 7 * 86400000);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(8 + offset, 0, 0, 0);
  return d.toISOString();
}
const booking = (overrides = {}) => ({
  service: String(service._id),
  professional: professional.user.id,
  startsAt: futureSlot(),
  acceptPolicy: true,
  policyVersion: business.policyVersion,
  ...overrides,
});
before(
  async () => {
    await mkdir(path.join(projectRoot, ".local/tmp"), { recursive: true });
    process.env.TMPDIR = path.join(projectRoot, ".local/tmp");
    process.env.MONGOMS_RUNTIME_DOWNLOAD = "false";
    await mkdir(path.join(projectRoot, ".local/mongodb-data"), {
      recursive: true,
    });
    // Dedicated test data directory avoids touching the persistent demonstration database.
    const { MongoMemoryReplSet } = await import("mongodb-memory-server");
    db = await MongoMemoryReplSet.create({
      binary: {
        version: "7.0.24",
        downloadDir: path.join(projectRoot, ".local/mongodb-binaries"),
      },
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(db.getUri("salon_integration"));
    await Promise.all(Object.values(models).map((m) => m.init()));
    app = createApp({
      NODE_ENV: "test",
      CLIENT_ORIGIN: origin,
      JWT_SECRET: secret,
      ADMIN_SETUP_TOKEN: secret,
      EMAIL_MODE: "safe",
    });
    const provision = await request(app)
      .post("/api/auth/provision-admin")
      .set("Origin", origin)
      .send({ ...account("Admin"), setupToken: secret });
    assert.equal(provision.status, 201, JSON.stringify(provision.body));
    admin = provision.body;
    for (const name of ["ProfessionalA", "ProfessionalB"]) {
      const created = await auth(
        "post",
        "/api/admin/professionals",
        admin,
      ).send({ ...account(name), whatsappNumber: "+26656903048" });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const logged = await request(app)
        .post("/api/auth/login")
        .send({ email: account(name).email, password: account(name).password });
      assert.equal(logged.status, 200);
      if (name === "ProfessionalA") professional = logged.body;
      else otherProfessional = logged.body;
    }
    customer = await register("Customer");
    other = await register("Other");
    service = (
      await auth("post", "/api/services", professional).send({
        name: "DEMO test service",
        description: "Synthetic",
        durationMinutes: 60,
        priceLisente: 25000,
      })
    ).body;
    business = await settings(professional.user.id);
    business.published = true;
    await business.save();
    const second = await settings(otherProfessional.user.id);
    second.published = true;
    await second.save();
  },
  { timeout: 180000 },
);
after(async () => {
  if (mongoose.connection.readyState === 1) {
    await models.Advertisement.deleteMany({}); // Dedicated ephemeral integration database only.
    const { cleanupAdvertisements } = await import("../src/advertisements.js");
    await cleanupAdvertisements(new Date(Date.now() + 2 * 3600000));
    const { cleanupBusinessMedia } = await import("../src/business-media.js");
    await cleanupBusinessMedia();
  }
  await mongoose.disconnect();
  if (db) await db.stop();
});
test("authentication: one-time provisioning, privilege escalation, persistence, rotation, logout and password revocation", async () => {
  assert.equal(
    (
      await request(app)
        .post("/api/auth/provision-admin")
        .set("Origin", origin)
        .send({ ...account("Owner2"), setupToken: secret })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/register")
        .send({ ...account("Evil"), role: "professional" })
    ).status,
    400,
  );
  assert.equal(
    (await auth("post", "/api/services", customer).send({})).status,
    403,
  );
  const logged = await request(app)
    .post("/api/auth/login")
    .send({
      email: account("Other").email,
      password: account("Other").password,
    });
  const cookie = logged.headers["set-cookie"][0].split(";")[0];
  assert.match(logged.headers["set-cookie"][0], /HttpOnly/);
  assert.equal(
    (
      await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookie)
        .set("Origin", "https://evil.test")
    ).status,
    403,
  );
  const refreshed = await request(app)
    .post("/api/auth/refresh")
    .set("Cookie", cookie)
    .set("Origin", origin);
  assert.equal(refreshed.status, 200);
  assert.equal(
    (
      await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookie)
        .set("Origin", origin)
    ).status,
    401,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/logout")
        .set("Origin", origin)
        .set("Cookie", refreshed.headers["set-cookie"][0].split(";")[0])
    ).status,
    200,
  );
  assert.equal((await auth("get", "/api/auth/me", refreshed.body)).status, 401);
  const changed = await auth("post", "/api/profile/password", other).send({
    currentPassword: account("Other").password,
    password: "Another-synthetic-password-123",
  });
  assert.equal(changed.status, 200);
  assert.equal((await auth("get", "/api/auth/me", other)).status, 401);
});
test("services and role checks preserve snapshots, validate durations and restrict professional permissions", async () => {
  assert.equal(
    (
      await auth("post", "/api/services", professional).send({
        name: "bad",
        durationMinutes: 17,
        priceLisente: 1,
      })
    ).status,
    400,
  );
  assert.equal((await auth("get", "/api/reports", admin)).status, 403);
  assert.equal(
    (await auth("get", "/api/professional/settings", customer)).status,
    403,
  );
});
test("professional account setup requires and normalizes a valid international WhatsApp number", async () => {
  assert.equal(
    (
      await auth("post", "/api/admin/professionals", admin).send(
        account("NoWhatsApp"),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await auth("post", "/api/admin/professionals", admin).send({
        ...account("InvalidWhatsApp"),
        whatsappNumber: "+266123",
      })
    ).status,
    400,
  );
  const created = await auth("post", "/api/admin/professionals", admin).send({
    ...account("NormalizedWhatsApp"),
    whatsappNumber: "+266 56903048",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(
    (await ProfessionalProfile.findOne({ professional: created.body.id }))
      .whatsappNumber,
    "+26656903048",
  );
});
let appointment, payment;
test("concurrent booking: exactly one overlapping reservation succeeds; availability excludes occupied slots", async () => {
  const results = await Promise.all([
    auth("post", "/api/appointments", customer).send(booking()),
    auth("post", "/api/appointments", customer).send(booking()),
  ]);
  assert.deepEqual(
    results.map((r) => r.status).sort(),
    [201, 409],
    results.map((r) => JSON.stringify(r.body)).join("\n"),
  );
  appointment = results.find((r) => r.status === 201).body;
  assert.equal(await Slot.countDocuments({ appointment: appointment._id }), 4);
  assert.equal(appointment.status, "pending_confirmation");
  assert.match(appointment.reference, /^SAL-[A-F0-9]{24}$/);
  const appointmentListing = await auth("get", "/api/appointments", customer);
  assert.equal(
    appointmentListing.body.items.find((item) => item._id === appointment._id)
      .paymentStatus,
    "awaiting_verification",
  );
  assert.ok(
    await Notification.exists({
      professional: professional.user.id,
      scope: "business",
      title: "New booking request",
      message: { $regex: appointment.reference },
    }),
  );
  assert.equal(appointmentListing.body.items.find((item) => item._id === appointment._id).status, "pending_confirmation");
  const slots = await request(app)
    .get("/api/public/availability")
    .query({
      service: service._id.toString(),
      professional: professional.user.id,
      date: futureSlot().slice(0, 10),
    });
  assert.equal(slots.status, 200);
  assert.ok(!slots.body.slots.includes(futureSlot()));
  assert.equal(
    (
      await auth(
        "post",
        `/api/appointments/${appointment._id}/action`,
        professional,
      ).send({ action: "complete" })
    ).status,
    409,
  );
});
test("manual payment record does not confirm; foreign professional verification denied; own professional verification atomic and idempotent", async () => {
  const recorded = await auth("post", "/api/payments", professional).send({
    appointment: appointment._id,
    amountLisente: 5000,
    method: "cash",
    reference: "DEMO-CASH-001",
    kind: "booking_fee",
  });
  assert.equal(recorded.status, 201, JSON.stringify(recorded.body));
  payment = recorded.body;
  assert.equal(
    (await Appointment.findById(appointment._id)).status,
    "pending_confirmation",
  );
  assert.equal(
    (
      await auth(
        "post",
        `/api/payments/${payment._id}/review`,
        otherProfessional,
      ).send({
        action: "verify",
        note: "Money independently checked",
      })
    ).status,
    404,
  );
  await Payment.updateOne({ _id: payment._id }, { $set: { amountLisente: 4999 } });
  assert.equal(
    (
      await auth("post", `/api/payments/${payment._id}/review`, professional).send({
        action: "verify",
        note: "Synthetic mismatched fee must not verify",
      })
    ).status,
    409,
  );
  await Payment.updateOne({ _id: payment._id }, { $set: { amountLisente: 5000 } });
  const reviews = await Promise.all(
    [1, 2].map(() =>
      auth("post", `/api/payments/${payment._id}/review`, professional).send({
        action: "verify",
        note: "Money independently checked",
      }),
    ),
  );
  assert.deepEqual(reviews.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await Appointment.findById(appointment._id)).status,
    "confirmed",
  );
  const confirmationNotice = await Notification.findOne({
    recipient: customer.user.id,
    title: "Appointment confirmed",
    message: { $regex: appointment.reference },
  });
  assert.ok(confirmationNotice);
  assert.match(confirmationNotice.message, /DEMO test service/);
  assert.match(confirmationNotice.message, /Booking fee paid: M 50\.00/);
  assert.match(confirmationNotice.message, /WhatsApp: \+26656903048/);
  assert.equal(
    await Payment.countDocuments({
      appointment: appointment._id,
      status: "paid",
    }),
    1,
  );
  assert.equal(
    (
      await auth("post", "/api/payments", professional).send({
        appointment: appointment._id,
        amountLisente: 5000,
        method: "cash",
        reference: "DEMO-CASH-002",
        kind: "booking_fee",
      })
    ).status,
    409,
  );
});
test("customer ownership, rescheduling, policy snapshots and expiry", async () => {
  const stranger = await register("Stranger");
  assert.equal(
    (
      await auth(
        "post",
        `/api/appointments/${appointment._id}/action`,
        stranger,
      ).send({ action: "cancel" })
    ).status,
    404,
  );
  const changed = await auth(
    "post",
    `/api/appointments/${appointment._id}/action`,
    customer,
  ).send({ action: "reschedule", startsAt: futureSlot(2) });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.priceLisente, 25000);
  assert.equal(changed.body.status, "confirmed");
  assert.equal(await Slot.countDocuments({ appointment: appointment._id }), 4);
  const hold = await auth("post", "/api/appointments", customer).send(
    booking(),
  );
  assert.equal(hold.status, 201);
  await Appointment.updateOne(
    { _id: hold.body._id },
    { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
  );
  await expireHolds();
  assert.equal((await Appointment.findById(hold.body._id)).expired, true);
  assert.equal(await Slot.countDocuments({ appointment: hold.body._id }), 0);
});
test("bookkeeping counts only verified money; partial balances and expenses reconcile deterministically", async () => {
  const result = await auth("post", "/api/payments", professional).send({
    appointment: appointment._id,
    amountLisente: 20000,
    method: "bank_transfer",
    reference: "DEMO-BALANCE-001",
    kind: "balance",
  });
  assert.equal(result.status, 201);
  assert.equal(
    (
      await auth(
        "post",
        `/api/payments/${result.body._id}/review`,
        professional,
      ).send({ action: "verify", note: "Received and checked" })
    ).status,
    200,
  );
  assert.equal(
    (
      await auth("post", "/api/expenses", professional).send({
        description: "DEMO products",
        category: "products",
        amountLisente: 3000,
        incurredAt: new Date().toISOString(),
      })
    ).status,
    201,
  );
  const reports = await auth("get", "/api/reports", professional);
  assert.equal(reports.status, 200);
  assert.equal(reports.body.receivedLisente, 25000);
  assert.equal(reports.body.bookingFeeIncomeLisente, 5000);
  assert.equal(reports.body.balanceIncomeLisente, 20000);
  assert.deepEqual(reports.body.expenseCategories, [
    { category: "products", amountLisente: 3000 },
  ]);
  assert.equal(reports.body.expenseLisente, 3000);
  assert.equal(reports.body.profitLisente, 22000);
  assert.equal(
    reports.body.outstanding.find((a) => a.reference === appointment.reference)
      .outstandingLisente,
    0,
  );
});
test("safe notifications never send real email; templates escape untrusted content", async () => {
  await deliverPending({ EMAIL_MODE: "safe" });
  assert.ok(await Notification.countDocuments({ status: "simulated" }));
  assert.equal(await Notification.countDocuments({ status: "sent" }), 0);
  assert.ok(!template("<script>", "<img>").html.includes("<script>"));
  assert.ok((await Audit.countDocuments()) > 0);
});
test("concurrent duplicate payment recording, rejection/retry, and expired-hold verification safety", async () => {
  const booked = await auth("post", "/api/appointments", customer).send(
    booking({ startsAt: futureSlot(4) }),
  );
  assert.equal(booked.status, 201, JSON.stringify(booked.body));
  const payload = {
    appointment: booked.body._id,
    amountLisente: 5000,
    method: "cash",
    kind: "booking_fee",
  };
  const race = await Promise.all(
    ["EDGE-A", "EDGE-B"].map((reference) =>
      auth("post", "/api/payments", professional).send({
        ...payload,
        reference,
      }),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  const pending = race.find((r) => r.status === 201).body;
  assert.equal(
    (
      await auth(
        "post",
        `/api/payments/${pending._id}/review`,
        professional,
      ).send({
        action: "request_info",
        note: "Need the external transaction details",
      })
    ).status,
    200,
  );
  assert.equal(
    (await Payment.findById(pending._id)).status,
    "awaiting_verification",
  );
  assert.equal(
    (await Appointment.findById(booked.body._id)).status,
    "pending_confirmation",
  );
  assert.equal(
    (
      await auth(
        "post",
        `/api/payments/${pending._id}/review`,
        professional,
      ).send({
        action: "reject",
        note: "Funds did not arrive",
      })
    ).status,
    200,
  );
  assert.equal(
    (await Appointment.findById(booked.body._id)).status,
    "awaiting_payment",
  );
  const retry = await auth("post", "/api/payments", professional).send({
    ...payload,
    reference: "EDGE-RETRY",
  });
  assert.equal(retry.status, 201);
  await Appointment.updateOne(
    { _id: booked.body._id },
    { $set: { holdExpiresAt: new Date(Date.now() - 1) } },
  );
  assert.equal(
    (
      await auth(
        "post",
        `/api/payments/${retry.body._id}/review`,
        professional,
      ).send({
        action: "verify",
        note: "Cannot accept expired hold",
      })
    ).status,
    409,
  );
  assert.equal((await Payment.findById(retry.body._id)).status, "expired");
  assert.equal(await Slot.countDocuments({ appointment: booked.body._id }), 0);
});
test("service updates preserve old snapshots; closures, stale policy, overpayment and customer payment writes rejected", async () => {
  const original = await Appointment.findById(appointment._id);
  const price = service.priceLisente;
  const changed = await auth(
    "patch",
    `/api/services/${service._id}`,
    professional,
  ).send({
    name: service.name,
    description: "Changed",
    durationMinutes: 60,
    priceLisente: price + 10000,
    imageUrl: "",
    active: true,
  });
  assert.equal(changed.status, 200);
  assert.equal(
    (await Appointment.findById(appointment._id)).priceLisente,
    original.priceLisente,
  );
  assert.equal(
    (
      await auth("post", "/api/appointments", customer).send(
        booking({ startsAt: "2020-01-01T10:00:00Z" }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await auth("post", "/api/appointments", customer).send(
        booking({ policyVersion: "outdated" }),
      )
    ).status,
    409,
  );
  assert.equal(
    (await auth("post", "/api/payments", customer).send({})).status,
    403,
  );
  assert.equal(
    (
      await auth("post", "/api/payments", professional).send({
        appointment: appointment._id,
        amountLisente: 1,
        method: "cash",
        reference: "OVERPAID",
        kind: "balance",
      })
    ).status,
    409,
  );
  await ProfessionalProfile.updateOne(
    { professional: professional.user.id },
    { $addToSet: { closedDates: futureSlot().slice(0, 10) } },
  );
  assert.equal(
    (
      await auth("post", "/api/appointments", customer).send(
        booking({ startsAt: futureSlot(4) }),
      )
    ).status,
    409,
  );
  await ProfessionalProfile.updateOne(
    { professional: professional.user.id },
    { $pull: { closedDates: futureSlot().slice(0, 10) } },
  );
});
test("conflicting reschedule rolls back; cancellation releases claims and retains verified nonrefundable income", async () => {
  const before = await Appointment.findById(appointment._id);
  const hold = await auth("post", "/api/appointments", customer).send(
    booking(),
  );
  assert.equal(hold.status, 201);
  const conflict = await auth(
    "post",
    `/api/appointments/${appointment._id}/action`,
    customer,
  ).send({ action: "reschedule", startsAt: futureSlot() });
  assert.equal(conflict.status, 409);
  assert.equal(
    +(await Appointment.findById(appointment._id)).startsAt,
    +before.startsAt,
  );
  assert.equal(await Slot.countDocuments({ appointment: appointment._id }), 4);
  const cancelled = await auth(
    "post",
    `/api/appointments/${appointment._id}/action`,
    customer,
  ).send({ action: "cancel" });
  assert.equal(cancelled.status, 200);
  assert.equal(await Slot.countDocuments({ appointment: appointment._id }), 0);
  assert.equal(
    await Payment.countDocuments({
      appointment: appointment._id,
      status: "paid",
    }),
    2,
  );
  assert.equal(
    (
      await auth(
        "post",
        `/api/appointments/${appointment._id}/action`,
        professional,
      ).send({ action: "reschedule", startsAt: futureSlot(2) })
    ).status,
    409,
  );
});
test("appointments enter in-progress only for the owning professional during the booking window", async () => {
  const held = await auth("post", "/api/appointments", customer).send(
    booking({ startsAt: futureSlot(4) }),
  );
  assert.equal(held.status, 201);
  await Appointment.updateOne(
    { _id: held.body._id },
    {
      $set: {
        status: "confirmed",
        startsAt: new Date(Date.now() - 60000),
        endsAt: new Date(Date.now() + 3600000),
      },
      $unset: { holdExpiresAt: 1 },
    },
  );
  await auth("post", `/api/appointments/${held.body._id}/action`, customer)
    .send({ action: "start" })
    .expect(403);
  const started = await auth(
    "post",
    `/api/appointments/${held.body._id}/action`,
    professional,
  )
    .send({ action: "start" })
    .expect(200);
  assert.equal(started.body.status, "in_progress");
  await auth("post", `/api/appointments/${held.body._id}/action`, professional)
    .send({ action: "start" })
    .expect(409);
  await auth("post", `/api/appointments/${held.body._id}/action`, professional)
    .send({ action: "reschedule", startsAt: futureSlot(2) })
    .expect(409);
  await auth("post", `/api/appointments/${held.body._id}/action`, professional)
    .send({ action: "cancel" })
    .expect(409);
  const completed = await auth(
    "post",
    `/api/appointments/${held.body._id}/action`,
    professional,
  )
    .send({ action: "complete" })
    .expect(200);
  assert.equal(completed.body.status, "completed");
  assert.equal(await Slot.countDocuments({ appointment: held.body._id }), 0);
});

test("completion/no-show transitions and account deactivation invalidate access", async () => {
  const held = await auth("post", "/api/appointments", customer).send(
    booking({ startsAt: futureSlot(4) }),
  );
  assert.equal(held.status, 201);
  await Appointment.updateOne(
    { _id: held.body._id },
    {
      $set: {
        status: "confirmed",
        startsAt: new Date(Date.now() - 7200000),
        endsAt: new Date(Date.now() - 3600000),
      },
      $unset: { holdExpiresAt: 1 },
    },
  );
  const completed = await auth(
    "post",
    `/api/appointments/${held.body._id}/action`,
    professional,
  ).send({ action: "complete" });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.status, "completed");
  assert.equal(await Slot.countDocuments({ appointment: held.body._id }), 0);
  const noShow = await auth("post", "/api/appointments", customer).send(
    booking({ startsAt: futureSlot(4) }),
  );
  assert.equal(noShow.status, 201);
  await Appointment.updateOne(
    { _id: noShow.body._id },
    {
      $set: {
        status: "confirmed",
        startsAt: new Date(Date.now() - 7200000),
        endsAt: new Date(Date.now() - 3600000),
      },
      $unset: { holdExpiresAt: 1 },
    },
  );
  const missed = await auth(
    "post",
    `/api/appointments/${noShow.body._id}/action`,
    professional,
  ).send({ action: "no_show" });
  assert.equal(missed.status, 200);
  assert.equal(missed.body.status, "no_show");
  await User.updateOne(
    { _id: professional.user.id },
    { $set: { active: false } },
  );
  assert.equal(
    (await auth("get", "/api/appointments", professional)).status,
    401,
  );
  await User.updateOne(
    { _id: professional.user.id },
    { $set: { active: true } },
  );
});
test("notification delivery failure is logged and safely retried without reversing a booking", async () => {
  await Notification.updateMany(
    { status: "pending" },
    { $set: { status: "simulated" } },
  );
  const record = await Notification.create({
    recipient: customer.user.id,
    professional: professional.user.id,
    scope: "business",
    title: "Synthetic delivery test",
    message: "No real customer contacted",
  });
  let calls = 0;
  await deliverPending(
    {
      EMAIL_MODE: "smtp",
      SMTP_HOST: "unused",
      SMTP_PORT: 587,
      SMTP_FROM: "salon@example.test",
    },
    () => ({
      async sendMail() {
        calls++;
        throw new Error("Synthetic SMTP failure");
      },
    }),
  );
  assert.equal((await Notification.findById(record._id)).status, "failed");
  assert.equal(calls, 1);
  const retried = await auth(
    "post",
    `/api/notifications/${record._id}/retry`,
    professional,
  ).send({});
  assert.equal(retried.status, 200);
  let envelope;
  await deliverPending(
    {
      EMAIL_MODE: "smtp",
      SMTP_HOST: "unused",
      SMTP_PORT: 587,
      SMTP_FROM: "salon@example.test",
    },
    () => ({
      async sendMail(value) {
        envelope = value;
      },
    }),
  );
  assert.equal((await Notification.findById(record._id)).status, "sent");
  assert.equal(envelope.to, account("Customer").email.toLowerCase());
  assert.match(envelope.html, /No real customer contacted/);
});
test("confirmation email failure is recorded without undoing verified payment or appointment", async () => {
  await Notification.updateMany({ status: "pending" }, { $set: { status: "simulated" } });
  const booked = await auth("post", "/api/appointments", customer).send(
    booking({ startsAt: futureSlot(6) }),
  );
  assert.equal(booked.status, 201);
  const recorded = await auth("post", "/api/payments", professional).send({
    appointment: booked.body._id,
    amountLisente: booked.body.feeLisente,
    method: "mobile_money_agent",
    reference: "EMAIL-FAILURE-SYNTHETIC",
    kind: "booking_fee",
  });
  assert.equal(recorded.status, 201, JSON.stringify(recorded.body));
  await Notification.updateMany({ status: "pending" }, { $set: { status: "simulated" } });
  const verification = await auth(
    "post",
    `/api/payments/${recorded.body._id}/review`,
    professional,
  ).send({ action: "verify", note: "Synthetic receipt independently confirmed." });
  assert.equal(verification.status, 200);
  await deliverPending(
    {
      EMAIL_MODE: "smtp",
      SMTP_HOST: "unused",
      SMTP_PORT: 587,
      SMTP_FROM: "salon@example.test",
    },
    () => ({ async sendMail() { throw new Error("Synthetic SMTP failure"); } }),
  );
  assert.equal((await Appointment.findById(booked.body._id)).status, "confirmed");
  assert.equal((await Payment.findById(recorded.body._id)).status, "paid");
  const confirmation = await Notification.findOne({
    recipient: customer.user.id,
    title: "Appointment confirmed",
    message: { $regex: booked.body.reference },
  });
  assert.equal(confirmation.status, "failed");
  assert.match(confirmation.message, /Booking reference:/);
  assert.match(confirmation.lastError, /Delivery failed/);
});
test("deterministic finance distinguishes booked value, rejected records and received money", () => {
  const summary = financialSummary(
    [
      { status: "paid", amountLisente: 5000 },
      { status: "paid", amountLisente: 20000 },
      { status: "awaiting_verification", amountLisente: 999999 },
      { status: "rejected", amountLisente: 1000 },
    ],
    [{ amountLisente: 2000 }, { amountLisente: 1000 }],
    [
      { status: "confirmed", totalLisente: 25000, serviceName: "Synthetic" },
      { status: "cancelled", totalLisente: 90000, serviceName: "Cancelled" },
    ],
  );
  assert.equal(summary.receivedLisente, 25000);
  assert.equal(summary.profitLisente, 22000);
  assert.equal(summary.bookedValueLisente, 25000);
  assert.deepEqual(summary.popularity, [{ name: "Synthetic", count: 1 }]);
});

test("three roles: only admin provisions professionals; all public and profile privilege injection is rejected", async () => {
  for (const role of ["admin", "professional", "owner", "staff"])
    assert.equal(
      (
        await request(app)
          .post("/api/auth/register")
          .send({ ...account("Escalation" + role), role })
      ).status,
      400,
    );
  for (const actor of [professional, otherProfessional, customer])
    assert.equal(
      (
        await auth("post", "/api/admin/professionals", actor).send(
          account("Forbidden"),
        )
      ).status,
      403,
    );
  assert.equal(
    (
      await auth("post", "/api/admin/professionals", admin).send({
        ...account("Injected"),
        role: "admin",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await auth("patch", "/api/profile", professional).send({
        name: "Changed",
        phone: "",
        role: "admin",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await auth("patch", "/api/profile", customer).send({
        name: "Changed",
        phone: "",
        professional: professional.user.id,
      })
    ).status,
    400,
  );
  const current = await User.findById(professional.user.id);
  assert.equal(current.role, "professional");
  assert.equal(String(current.createdBy), admin.user.id);
});
let serviceB, bookingB, paymentB, customerB;
test("independent professional creates owned business records and scopes customer relationships", async () => {
  const created = await auth("post", "/api/services", otherProfessional).send({
    name: "B private catalogue service",
    durationMinutes: 60,
    priceLisente: 40000,
  });
  assert.equal(created.status, 201);
  serviceB = created.body;
  assert.equal(serviceB.professional, otherProfessional.user.id);
  const c = await auth("post", "/api/customers", otherProfessional).send(
    account("BusinessBCustomer"),
  );
  assert.equal(c.status, 201);
  customerB = c.body;
  const booked = await auth(
    "post",
    "/api/appointments",
    otherProfessional,
  ).send({
    service: serviceB._id,
    professional: otherProfessional.user.id,
    customer: customerB.id,
    startsAt: futureSlot(),
    acceptPolicy: true,
    policyVersion: "1",
  });
  assert.equal(booked.status, 201, JSON.stringify(booked.body));
  bookingB = booked.body;
  const paid = await auth("post", "/api/payments", otherProfessional).send({
    appointment: bookingB._id,
    amountLisente: 5000,
    method: "cash",
    reference: "B-PRIVATE-REF",
    kind: "booking_fee",
  });
  assert.equal(paid.status, 201);
  paymentB = paid.body;
  assert.equal(
    (
      await auth("post", "/api/expenses", otherProfessional).send({
        description: "B private expense",
        category: "other",
        amountLisente: 777,
        incurredAt: new Date().toISOString(),
      })
    ).status,
    201,
  );
  const a = await auth("get", "/api/customers", professional);
  assert.ok(!a.body.items.some((c) => c._id === customerB.id));
  assert.equal(
    (
      await auth("post", "/api/appointments", professional).send(
        booking({ customer: customerB.id, startsAt: futureSlot(4) }),
      )
    ).status,
    404,
  );
});
test("private lists, totals, populations and query-string ownership overrides cannot cross professionals", async () => {
  for (const endpoint of [
    "services",
    "appointments",
    "payments",
    "expenses",
    "customers",
    "audit",
    "notifications",
  ]) {
    const response = await auth(
      "get",
      `/api/${endpoint}?professional=${professional.user.id}`,
      otherProfessional,
    );
    assert.equal(response.status, 200, endpoint);
    if (
      [
        "services",
        "appointments",
        "payments",
        "expenses",
        "audit",
        "notifications",
      ].includes(endpoint)
    )
      for (const item of response.body.items)
        assert.equal(
          String(item.professional?._id || item.professional),
          otherProfessional.user.id,
          endpoint,
        );
  }
  const report = await auth(
    "get",
    `/api/reports?professional=${professional.user.id}`,
    otherProfessional,
  );
  assert.equal(report.status, 200);
  assert.equal(report.body.receivedLisente, 0);
  assert.equal(report.body.expenseLisente, 777);
  assert.equal(report.body.profitLisente, -777);
  const overview = await auth(
    "get",
    "/api/professional/overview",
    otherProfessional,
  );
  assert.equal(overview.status, 200);
  assert.equal(overview.body.appointments, 1);
  assert.equal(overview.body.customers, 1);
  const profile = await auth(
    "get",
    `/api/professional/settings?professional=${professional.user.id}`,
    otherProfessional,
  );
  assert.equal(profile.body.professional, otherProfessional.user.id);
});
test("foreign record identifiers and forged ownership on writes are denied without mutation", async () => {
  assert.equal(
    (
      await auth("patch", `/api/services/${serviceB._id}`, professional).send({
        name: "Stolen",
        durationMinutes: 60,
        priceLisente: 1,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await auth("post", "/api/services", professional).send({
        name: "Forged",
        durationMinutes: 60,
        priceLisente: 1,
        professional: otherProfessional.user.id,
      })
    ).status,
    400,
  );
  for (const action of ["cancel", "complete", "no_show"])
    assert.equal(
      (
        await auth(
          "post",
          `/api/appointments/${bookingB._id}/action`,
          professional,
        ).send({ action })
      ).status,
      404,
    );
  assert.equal(
    (
      await auth("post", "/api/payments", professional).send({
        appointment: bookingB._id,
        amountLisente: 5000,
        method: "cash",
        reference: "WRONG-BUSINESS",
        kind: "booking_fee",
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await auth(
        "post",
        `/api/payments/${paymentB._id}/review`,
        professional,
      ).send({ action: "verify", note: "Not my business" })
    ).status,
    404,
  );
  assert.equal(
    (
      await auth("post", "/api/appointments", customer).send({
        ...booking(),
        service: serviceB._id,
      })
    ).status,
    404,
  );
  assert.equal(
    (await Payment.findById(paymentB._id)).status,
    "awaiting_verification",
  );
  assert.equal(
    (await Appointment.findById(bookingB._id)).status,
    "pending_confirmation",
  );
  assert.equal(
    (await Service.findById(serviceB._id)).name,
    "B private catalogue service",
  );
});
test("admin manages accounts and platform settings but cannot access or verify any professional finances", async () => {
  await User.updateOne(
    { _id: admin.user.id },
    { $set: { canVerifyPayments: true } },
  ); // Legacy flag is deliberately ignored.
  for (const endpoint of [
    "payments",
    "expenses",
    "reports",
    "appointments",
    "services",
    "customers",
    "professional/settings",
    "professional/overview",
  ])
    assert.equal(
      (await auth("get", "/api/" + endpoint, admin)).status,
      403,
      endpoint,
    );
  for (const endpoint of ["payments", "expenses", "appointments", "services"])
    assert.equal(
      (await auth("post", "/api/" + endpoint, admin).send({})).status,
      403,
      endpoint,
    );
  assert.equal(
    (
      await auth("post", `/api/payments/${paymentB._id}/review`, admin).send({
        action: "verify",
        note: "Admin must not verify",
      })
    ).status,
    403,
  );
  const overview = await auth("get", "/api/admin/overview", admin);
  assert.equal(overview.status, 200);
  assert.deepEqual(Object.keys(overview.body).sort(), [
    "admins",
    "customers",
    "professionals",
  ]);
  const accounts = await auth("get", "/api/admin/accounts", admin);
  assert.equal(accounts.status, 200);
  for (const user of accounts.body.items)
    for (const key of Object.keys(user))
      assert.ok(
        [
          "_id",
          "name",
          "email",
          "phone",
          "role",
          "active",
          "createdAt",
        ].includes(key),
        key,
      );
  assert.equal(
    (
      await auth("put", "/api/admin/settings", admin).send({
        platformName: "Updated demo platform",
        description: "Platform only",
        demo: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await auth("put", "/api/admin/settings", admin).send({
        platformName: "Bad override",
        description: "",
        demo: true,
        bookingFeeLisente: 1,
      })
    ).status,
    400,
  );
  const audit = await auth("get", "/api/audit", admin);
  for (const event of audit.body.items) {
    assert.equal(event.scope, "platform");
    assert.equal(event.professional, undefined);
    assert.ok(!event.action.startsWith("payment."));
  }
  assert.equal(
    (await auth("get", "/api/admin/accounts", professional)).status,
    403,
  );
  assert.equal(
    (await Payment.findById(paymentB._id)).status,
    "awaiting_verification",
  );
});
test("professionals own availability, booking settings, WhatsApp and publication independently", async () => {
  const beforeA = await models.ProfessionalProfile.findOne({
    professional: professional.user.id,
  }).lean();
  const b = (await auth("get", "/api/professional/settings", otherProfessional))
    .body;
  const keys = [
    "salonName",
    "description",
    "demo",
    "whatsappNumber",
    "phone",
    "email",
    "address",
    "openingHours",
    "closedDates",
    "bookingFeeLisente",
    "feeDeducted",
    "holdMinutes",
    "policyText",
    "changeNoticeHours",
    "published",
  ];
  const body = Object.fromEntries(keys.map((k) => [k, b[k]]));
  body.salonName = "Business B published profile";
  body.whatsappNumber = "+266 5000 0000";
  body.bookingFeeLisente = 7500;
  assert.equal(
    (
      await auth("put", "/api/professional/settings", otherProfessional).send({
        ...body,
        whatsappNumber: "56903048",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await auth("put", "/api/professional/settings", otherProfessional).send({
        ...body,
        professional: professional.user.id,
      })
    ).status,
    400,
  );
  const updated = await auth(
    "put",
    "/api/professional/settings",
    otherProfessional,
  ).send(body);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.professional, otherProfessional.user.id);
  assert.equal(updated.body.bookingFeeLisente, 7500);
  const afterA = await models.ProfessionalProfile.findOne({
    professional: professional.user.id,
  }).lean();
  assert.deepEqual(afterA, beforeA);
  assert.equal(
    (
      await auth(
        "put",
        "/api/professional/availability",
        otherProfessional,
      ).send({
        weekdays: [1, 2, 3, 4, 5],
        workStart: "10:00",
        workEnd: "16:00",
      })
    ).status,
    200,
  );
  assert.equal((await User.findById(professional.user.id)).workStart, "09:00");
  const pub = await request(app).get("/api/public/settings");
  assert.equal(pub.body.bookingFeeLisente, undefined);
  assert.equal(pub.body.whatsappNumber, undefined);
  const publicB = await request(app).get(
    "/api/public/professionals/" + otherProfessional.user.id,
  );
  assert.equal(publicB.status, 200);
  assert.equal(publicB.body.whatsappNumber, "+26650000000");
  assert.equal(publicB.body.email, b.email);
  assert.equal(publicB.body.password, undefined);
  await models.ProfessionalProfile.updateOne(
    { professional: otherProfessional.user.id },
    { $set: { whatsappNumber: "" } },
  );
  assert.equal(
    (
      await auth("post", "/api/appointments", customer).send(
        booking({ professional: otherProfessional.user.id, service: serviceB._id, startsAt: futureSlot(6), policyVersion: updated.body.policyVersion }),
      )
    ).status,
    409,
  );
  await models.ProfessionalProfile.updateOne(
    { professional: otherProfessional.user.id },
    { $set: { whatsappNumber: "+26650000000" } },
  );
});
test("same professional slot conflicts but separate professionals may reserve the same time and receipt reference", async () => {
  const newCustomer = await register("CrossBusinessCustomer");
  const bProfile = await settings(otherProfessional.user.id);
  const time = futureSlot(2);
  const localStart = new Date(+new Date(time) + 2 * 3600000);
  const localDay = String(localStart.getUTCDay());
  const localDate = localStart.toISOString().slice(0, 10);
  await User.updateMany(
    { _id: { $in: [professional.user.id, otherProfessional.user.id] } },
    { $set: { weekdays: [1, 2, 3, 4, 5, 6], workStart: "09:00", workEnd: "17:00" } },
  );
  for (const owner of [professional, otherProfessional]) {
    const profile = await settings(owner.user.id);
    profile.openingHours.set(localDay, "09:00-17:00");
    profile.closedDates = profile.closedDates.filter((date) => date !== localDate);
    await profile.save();
  }
  const both = await Promise.all([
    auth("post", "/api/appointments", newCustomer).send(
      booking({
        startsAt: time,
        policyVersion: (await settings(professional.user.id)).policyVersion,
      }),
    ),
    auth("post", "/api/appointments", newCustomer).send({
      service: serviceB._id,
      professional: otherProfessional.user.id,
      startsAt: time,
      acceptPolicy: true,
      policyVersion: bProfile.policyVersion,
    }),
  ]);
  // Both independent businesses are configured to accept this shared local-noon slot.
  assert.deepEqual(
    both.map((r) => r.status),
    [201, 201],
    both.map((r) => JSON.stringify(r.body)).join("\n"),
  );
  assert.notEqual(both[0].body.reference, both[1].body.reference);
  for (const [index, actor] of [professional, otherProfessional].entries()) {
    const fee = both[index].body.feeLisente;
    const payment = await auth("post", "/api/payments", actor).send({
      appointment: both[index].body._id,
      amountLisente: fee,
      method: "cash",
      reference: "SAME-EXTERNAL-REF",
      kind: "booking_fee",
    });
    assert.equal(payment.status, 201, JSON.stringify(payment.body));
  }
  const mine = await auth("get", "/api/payments", newCustomer);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.total, 2);
  assert.equal(
    (
      await auth(
        "post",
        `/api/appointments/${bookingB._id}/action`,
        newCustomer,
      ).send({ action: "cancel" })
    ).status,
    404,
  );
});
test("legacy roles and unassigned rows are preserved, quarantined and reported by read-only migration assessment", async () => {
  const stored = await User.collection.findOne({
    _id: new mongoose.Types.ObjectId(professional.user.id),
  });
  const legacy = await User.collection.insertOne({
    name: "Historical owner",
    email: "legacy-owner@example.test",
    password: stored.password,
    role: "owner",
    active: true,
    tokenVersion: 0,
  });
  const rawService = {
    name: "Legacy global service",
    durationMinutes: 60,
    priceLisente: 12345,
    active: true,
  };
  const old = await Service.collection.insertOne(rawService);
  const original = await Service.collection.findOne({ _id: old.insertedId });
  const oldUser = await User.collection.findOne({ _id: legacy.insertedId });
  const login = await request(app)
    .post("/api/auth/login")
    .send({
      email: "legacy-owner@example.test",
      password: account("ProfessionalA").password,
    });
  assert.equal(login.status, 403);
  const oldSession = await Session.create({
    user: legacy.insertedId,
    tokenHash: "legacy-session-hash",
    expiresAt: new Date(Date.now() + 60000),
  });
  const { issueToken } = await import("../src/auth.js");
  assert.equal(
    (
      await request(app)
        .get("/api/reports")
        .set(
          "Authorization",
          "Bearer " + issueToken(oldUser, secret, oldSession._id),
        )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/provision-owner")
        .set("Origin", origin)
        .send({ ...account("NoLegacyBootstrap"), setupToken: secret })
    ).status,
    410,
  );
  for (const actor of [professional, otherProfessional]) {
    const listing = await auth("get", "/api/services", actor);
    assert.ok(
      !listing.body.items.some((item) => item._id === String(old.insertedId)),
    );
  }
  const pub = await request(app).get("/api/public/services");
  assert.ok(
    !pub.body.items.some((item) => item._id === String(old.insertedId)),
  );
  const assessed = await assessMigration(mongoose.connection.db);
  assert.equal(assessed.mode, "read-only");
  assert.equal(assessed.applied, false);
  assert.equal(assessed.requiresExplicitMappings, true);
  assert.equal(assessed.records.services.unassigned, 1);
  assert.deepEqual(
    await Service.collection.findOne({ _id: old.insertedId }),
    original,
  );
  assert.deepEqual(
    await User.collection.findOne({ _id: legacy.insertedId }),
    oldUser,
  );
  assert.equal(
    JSON.stringify(assessed).includes("legacy-owner@example.test"),
    false,
  );
  assert.equal(JSON.stringify(assessed).includes("12345"), false);
});
test("advertisement foundation requires professional ownership and exactly seven published days", async () => {
  const { Advertisement } = models;
  await assert.rejects(new Advertisement({ title: "No owner" }).validate());
  const doc = new Advertisement({
    professional: professional.user.id,
    title: "DEMO advertisement",
    status: "published",
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 8 * 86400000),
    moderatedBy: admin.user.id,
    moderatedAt: new Date(),
  });
  await assert.rejects(doc.validate(), /seven-day/);
  doc.endsAt = new Date(+doc.startsAt + 7 * 86400000);
  await doc.validate();
});
test("draft profiles stay private while professionals can manage their own unpublished availability", async () => {
  await models.ProfessionalProfile.updateOne(
    { professional: otherProfessional.user.id },
    { $set: { published: false } },
  );
  const publicList = await request(app)
    .get("/api/public/services")
    .query({ professional: otherProfessional.user.id });
  assert.equal(publicList.body.total, 0);
  assert.equal(
    (
      await request(app).get(
        "/api/public/professionals/" + otherProfessional.user.id,
      )
    ).status,
    404,
  );
  const query = { service: serviceB._id, date: futureSlot().slice(0, 10) };
  assert.equal(
    (
      await request(app)
        .get("/api/public/availability")
        .query({ ...query, professional: otherProfessional.user.id })
    ).status,
    404,
  );
  const own = await auth(
    "get",
    "/api/professional/availability/slots",
    otherProfessional,
  ).query(query);
  assert.equal(own.status, 200);
  assert.ok(own.body.slots.length > 0);
  assert.equal(
    (
      await auth(
        "get",
        "/api/professional/availability/slots",
        professional,
      ).query(query)
    ).status,
    404,
  );
  await models.ProfessionalProfile.updateOne(
    { professional: otherProfessional.user.id },
    { $set: { published: true } },
  );
});
test("inconsistent payment relationships are quarantined from listings and reports", async () => {
  const broken = await Payment.collection.insertOne({
    professional: professional.user.id
      ? new mongoose.Types.ObjectId(professional.user.id)
      : null,
    appointment: new mongoose.Types.ObjectId(bookingB._id),
    amountLisente: 888888,
    status: "paid",
    method: "cash",
    reference: "INCONSISTENT-LEGACY",
    kind: "booking_fee",
    verifiedAt: new Date(),
    verifiedBy: new mongoose.Types.ObjectId(professional.user.id),
    recordedBy: new mongoose.Types.ObjectId(professional.user.id),
  });
  const listing = await auth("get", "/api/payments", professional);
  assert.ok(
    !listing.body.items.some((p) => p._id === String(broken.insertedId)),
  );
  const report = await auth("get", "/api/reports", professional);
  assert.equal(report.body.receivedLisente, 30000);
  const raw = await Payment.collection.findOne({ _id: broken.insertedId });
  assert.equal(raw.amountLisente, 888888); // Quarantine never deletes a suspicious historical record.
});
test("admin account status management revokes sessions without changing business ownership or history", async () => {
  const logged = await request(app)
    .post("/api/auth/login")
    .send({
      email: account("ProfessionalB").email,
      password: account("ProfessionalB").password,
    });
  assert.equal(logged.status, 200);
  const oldRefresh = logged.headers["set-cookie"][0].split(";")[0];
  const before = await Appointment.countDocuments({
    professional: otherProfessional.user.id,
  });
  assert.equal(
    (
      await auth(
        "patch",
        `/api/admin/accounts/${otherProfessional.user.id}`,
        professional,
      ).send({ active: false })
    ).status,
    403,
  );
  assert.equal(
    (
      await auth(
        "patch",
        `/api/admin/accounts/${otherProfessional.user.id}`,
        admin,
      ).send({ active: false, role: "admin" })
    ).status,
    400,
  );
  assert.equal(
    (
      await auth(
        "patch",
        `/api/admin/accounts/${otherProfessional.user.id}`,
        admin,
      ).send({ active: false })
    ).status,
    200,
  );
  assert.equal(
    (await auth("get", "/api/services", otherProfessional)).status,
    401,
  );
  assert.equal(
    (
      await request(app).get(
        "/api/public/professionals/" + otherProfessional.user.id,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await auth(
        "patch",
        `/api/admin/accounts/${otherProfessional.user.id}`,
        admin,
      ).send({ active: true })
    ).status,
    200,
  );
  assert.equal(
    (await auth("get", "/api/services", otherProfessional)).status,
    401,
  ); // Reactivation does not resurrect a revoked access token.
  assert.equal(
    (
      await request(app)
        .post("/api/auth/refresh")
        .set("Origin", origin)
        .set("Cookie", oldRefresh)
    ).status,
    401,
  );
  assert.equal(
    await Appointment.countDocuments({
      professional: otherProfessional.user.id,
    }),
    before,
  );
  assert.equal(
    (await User.findById(otherProfessional.user.id)).role,
    "professional",
  );
});
test("public service projection publishes business identity without private account identity", async () => {
  const response = await request(app).get("/api/public/services");
  assert.equal(response.status, 200);
  for (const service of response.body.items) {
    assert.equal(typeof service.professional, "string");
    assert.equal(typeof service.professionalName, "string");
    assert.equal(service.email, undefined);
  }
  const body = JSON.stringify(response.body);
  assert.equal(body.includes(account("ProfessionalA").email), false);
  assert.equal(body.includes('"name":"ProfessionalA"'), false);
});

test("professional profile and service image uploads are owned, persistent, public only when published, and removable", async () => {
  const fresh = await request(app)
    .post("/api/auth/login")
    .send({ email: account("ProfessionalB").email, password: account("ProfessionalB").password });
  assert.equal(fresh.status, 200);
  otherProfessional = fresh.body;
  const sharp = (await import("sharp")).default;
  const bytes = await sharp({
    create: { width: 12, height: 8, channels: 3, background: "#775599" },
  })
    .png()
    .toBuffer();
  const photo = await auth("put", "/api/professional/profile/photo", professional)
    .set("Content-Type", "image/png")
    .send(bytes)
    .expect(200);
  assert.equal(photo.body.photoUrl, `/api/public/professionals/${professional.user.id}/photo`);
  assert.equal(
    (await auth("get", "/api/professional/settings", professional)).body.photoUrl,
    photo.body.photoUrl,
  );
  await request(app).get(photo.body.photoUrl).expect(200).expect("Content-Type", /image\/webp/);
  await auth("put", `/api/professional/services/${service._id}/image`, otherProfessional)
    .set("Content-Type", "image/png")
    .send(bytes)
    .expect(404);
  await auth("put", `/api/professional/services/${service._id}/image`, admin)
    .set("Content-Type", "image/png")
    .send(bytes)
    .expect(403);
  const uploaded = await auth("put", `/api/professional/services/${service._id}/image`, professional)
    .set("Content-Type", "image/png")
    .send(bytes)
    .expect(200);
  const services = await request(app)
    .get("/api/public/services")
    .query({ professional: professional.user.id });
  assert.equal(
    services.body.items.find((row) => row._id === String(service._id)).imageUrl,
    uploaded.body.imageUrl,
  );
  await request(app).get(uploaded.body.imageUrl).expect(200).expect("Content-Type", /image\/webp/);
  const serviceImageId = (await Service.findById(service._id)).image;
  const photoId = (await ProfessionalProfile.findOne({ professional: professional.user.id })).photo;
  await auth("delete", `/api/professional/services/${service._id}/image`, professional).expect(200);
  await auth("delete", "/api/professional/profile/photo", professional).expect(200);
  await (await import("../src/business-media.js")).cleanupBusinessMedia();
  assert.equal(await models.BusinessMedia.exists({ _id: serviceImageId }), null);
  assert.equal(await models.BusinessMedia.exists({ _id: photoId }), null);
  await request(app).get(uploaded.body.imageUrl).expect(404);
  assert.equal(
    (await request(app).get(`/api/public/professionals/${professional.user.id}`)).body.photoUrl,
    null,
  );
});

test("advertisement videos validate MP4/WebM containers and replace and expire safely", async () => {
  const { cleanupAdvertisements } = await import("../src/advertisements.js");
  const base = "/api/professional/advertisements";
  const created = await auth("post", base, professional).send({ title: "DEMO video ad" });
  const id = created.body._id;
  await auth("post", `${base}/${id}/publish`, professional).expect(200);
  await auth("put", `${base}/${id}/video`, professional)
    .set("Content-Type", "video/mp4")
    .send(Buffer.from("not a video"))
    .expect(400);
  const mp4 = Buffer.alloc(16);
  mp4.writeUInt32BE(16, 0);
  mp4.write("ftyp", 4, "ascii");
  mp4.write("isom", 8, "ascii");
  await auth("put", `${base}/${id}/video`, otherProfessional)
    .set("Content-Type", "video/mp4")
    .send(mp4)
    .expect(404);
  const first = await auth("put", `${base}/${id}/video`, professional)
    .set("Content-Type", "video/mp4")
    .send(mp4)
    .expect(200);
  assert.equal(first.body.videoUrl, `/api/public/advertisements/${id}/video`);
  await request(app).get(first.body.videoUrl).expect(200).expect("Content-Type", /video\/mp4/);
  await request(app)
    .get(first.body.videoUrl)
    .set("Range", "bytes=0-7")
    .expect(206)
    .expect("Content-Range", "bytes 0-7/16");
  const firstMediaId = (await Advertisement.findById(id)).video;
  const webm = Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    Buffer.from([0x42, 0x82, 0x84]),
    Buffer.from("webm"),
  ]);
  const second = await auth("put", `${base}/${id}/video`, professional)
    .set("Content-Type", "video/webm")
    .send(webm)
    .expect(200);
  await cleanupAdvertisements();
  assert.equal(await models.AdvertisementImage.exists({ _id: firstMediaId }), null);
  await request(app).get(second.body.videoUrl).expect(200).expect("Content-Type", /video\/webm/);
  const secondMediaId = (await Advertisement.findById(id)).video;
  const removed = await auth("delete", `${base}/${id}/media`, professional).expect(200);
  assert.equal(removed.body.videoUrl, null);
  await cleanupAdvertisements();
  assert.equal(await models.AdvertisementImage.exists({ _id: secondMediaId }), null);
  await request(app).get(second.body.videoUrl).expect(404);
  const finalVideo = await auth("put", `${base}/${id}/video`, professional)
    .set("Content-Type", "video/webm")
    .send(webm)
    .expect(200);
  const expiresAt = new Date(Date.now() - 1000);
  await Advertisement.updateOne(
    { _id: id },
    { $set: { startsAt: new Date(+expiresAt - 7 * 86400000), endsAt: expiresAt } },
  );
  await cleanupAdvertisements();
  await request(app).get(finalVideo.body.videoUrl).expect(404);
  await auth("delete", `${base}/${id}`, professional).expect(204);
});

test("professional ads: roles, isolation, concurrent limit, publication and renewal", async () => {
  const fresh = await request(app)
    .post("/api/auth/login")
    .send({
      email: account("ProfessionalB").email,
      password: account("ProfessionalB").password,
    });
  assert.equal(fresh.status, 200);
  otherProfessional = fresh.body;
  const base = "/api/professional/advertisements";
  for (const actor of [admin, customer])
    assert.equal((await auth("get", base, actor)).status, 403);
  const ids = [];
  for (let i = 0; i < 4; i++) {
    const r = await auth("post", base, professional).send({
      title: "DEMO promotion " + i,
    });
    assert.equal(r.status, 201);
    ids.push(r.body._id);
  }
  assert.equal(
    (
      await auth("post", base, professional).send({
        title: "forged",
        professional: otherProfessional.user.id,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await auth("patch", base + "/" + ids[0], otherProfessional).send({
        title: "foreign",
      })
    ).status,
    404,
  );
  assert.equal(
    (await auth("get", base, otherProfessional)).body.items.some((a) =>
      ids.includes(a._id),
    ),
    false,
  );
  const results = await Promise.all(
    ids.map((id) => auth("post", base + "/" + id + "/publish", professional)),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 3);
  assert.equal(results.filter((r) => r.status === 409).length, 1);
  for (const actor of [admin, customer, otherProfessional]) {
    const expected = actor === otherProfessional ? 404 : 403;
    for (const action of ["publish", "unpublish"]) {
      await auth("post", base + "/" + ids[0] + "/" + action, actor).expect(
        expected,
      );
    }
    await auth("delete", base + "/" + ids[0], actor).expect(expected);
  }
  const published = results.find((r) => r.status === 200).body;
  assert.equal(
    +new Date(published.endsAt) - +new Date(published.startsAt),
    7 * 86400000,
  );
  assert.equal(
    (await request(app).get("/api/public/advertisements")).body.items.some(
      (a) => a._id === published._id,
    ),
    true,
  );
  await auth("patch", base + "/" + published._id, professional)
    .send({ title: "edited" })
    .expect(200);
  assert.equal(
    (await models.Advertisement.findById(published._id)).endsAt.toISOString(),
    published.endsAt,
  );
  await auth(
    "post",
    base + "/" + published._id + "/unpublish",
    professional,
  ).expect(200);
  assert.equal(
    (await request(app).get("/api/public/advertisements")).body.items.some(
      (a) => a._id === published._id,
    ),
    false,
  );
  const renewed = await auth(
    "post",
    base + "/" + published._id + "/publish",
    professional,
  ).expect(200);
  assert.ok(+new Date(renewed.body.startsAt) > +new Date(published.startsAt));
  for (const id of ids)
    await auth("delete", base + "/" + id, professional).expect(204);
});

test("ad images: validation, ownership, replacement, exact expiry and retryable shared-file cleanup", async () => {
  const { cleanupAdvertisements, activeAds } =
    await import("../src/advertisements.js");
  const { imageStorage } = await import("../src/ad-storage.js");
  const sharp = (await import("sharp")).default;
  const base = "/api/professional/advertisements";
  const created = await auth("post", base, professional).send({
    title: "DEMO image test",
  });
  const id = created.body._id;
  const bytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#a090b0" },
  })
    .png()
    .toBuffer();
  await auth("put", base + "/" + id + "/image", otherProfessional)
    .set("Content-Type", "image/png")
    .send(bytes)
    .expect(404);
  await auth("put", base + "/" + id + "/image", professional)
    .set("Content-Type", "image/png")
    .send(Buffer.from("invalid"))
    .expect(400);
  await auth("put", base + "/" + id + "/image", professional)
    .set("Content-Type", "image/png")
    .send(Buffer.alloc(5 * 1024 * 1024 + 1))
    .expect(413);
  await auth("put", base + "/" + id + "/image", professional)
    .set("Content-Type", "image/png")
    .send(bytes)
    .expect(200);
  let ad = await Advertisement.findById(id);
  const first = await models.AdvertisementImage.findById(ad.image);
  await request(app)
    .get("/api/public/advertisements/" + id + "/image")
    .expect(404);
  await auth("put", base + "/" + id + "/image", professional)
    .set("Content-Type", "image/png")
    .send(bytes)
    .expect(200);
  await cleanupAdvertisements();
  assert.equal(
    await models.AdvertisementImage.exists({ _id: first._id }),
    null,
  );
  await assert.rejects(imageStorage().get(first.key));
  await auth("post", base + "/" + id + "/publish", professional).expect(200);
  ad = await Advertisement.findById(id);
  await request(app)
    .get("/api/public/advertisements/" + id + "/image")
    .expect(200)
    .expect("Content-Type", /image\/webp/);
  assert.ok(
    await Advertisement.exists({
      _id: id,
      ...activeAds(new Date(+ad.endsAt - 1)),
    }),
  );
  assert.equal(
    await Advertisement.exists({ _id: id, ...activeAds(ad.endsAt) }),
    null,
  );
  const shared = await Advertisement.create({
    professional: professional.user.id,
    title: "DEMO shared",
    image: ad.image,
  });
  const cutoff = new Date(Date.now() - 1);
  await Advertisement.updateOne(
    { _id: id },
    { $set: { startsAt: new Date(+cutoff - 7 * 86400000), endsAt: cutoff } },
  );
  const visible = await request(app).get("/api/public/advertisements");
  assert.equal(
    visible.body.items.some((row) => row._id === id),
    false,
  );
  await request(app)
    .get("/api/public/advertisements/" + id + "/image")
    .expect(404);
  assert.equal((await Advertisement.findById(id)).status, "published"); // No cleanup yet.
  await cleanupAdvertisements();
  assert.ok(await models.AdvertisementImage.exists({ _id: ad.image }));
  await request(app)
    .get("/api/public/advertisements/" + id + "/image")
    .expect(404);
  await auth("delete", base + "/" + shared._id, professional).expect(204);
  await cleanupAdvertisements(new Date(), {
    remove: async () => {
      throw new Error("synthetic private failure");
    },
  });
  assert.equal(
    (await models.AdvertisementImage.findById(ad.image)).failureCount,
    1,
  );
  await cleanupAdvertisements();
  await cleanupAdvertisements();
  assert.equal(await models.AdvertisementImage.exists({ _id: ad.image }), null);
  await auth("delete", base + "/" + id, professional).expect(204);
});
