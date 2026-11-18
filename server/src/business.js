import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import {
  Appointment,
  Slot,
  Payment,
  User,
  Service,
  ProfessionalCustomer,
  GuestCustomer,
  Audit,
  Notification,
  ProfessionalProfile,
} from "./models.js";
import {
  professionalSettings,
  requireProfessional,
  assignedScope,
  appointmentScope,
} from "./tenancy.js";
export class BusinessError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new BusinessError(status, message);
};
export const settings = professionalSettings;
export const tx = (callback) => mongoose.connection.transaction(callback);
export async function audit(
  actor,
  action,
  entity,
  entityId,
  details,
  session,
  professional,
) {
  await Audit.create(
    [
      {
        actor,
        action,
        entity,
        entityId: String(entityId),
        details,
        professional,
        scope: professional ? "business" : "platform",
      },
    ],
    { session },
  );
}
export async function notify(recipient, title, message, session, professional) {
  await Notification.create(
    [
      {
        recipient,
        title,
        message,
        channel: "email",
        professional,
        scope: professional ? "business" : "personal",
      },
    ],
    {
      session,
    },
  );
}
export const slotsFor = (start, end) => {
  const result = [];
  for (let time = +new Date(start); time < +new Date(end); time += 15 * 60000)
    result.push(time / 60000);
  return result;
};
export function localParts(date) {
  const d = new Date(+new Date(date) + 2 * 3600000);
  return {
    day: d.getUTCDay(),
    date: d.toISOString().slice(0, 10),
    clock: d.toISOString().slice(11, 16),
  };
}
export function validateTime(startsAt, duration, provider, business) {
  if (!provider?.active) fail(409, "Professional unavailable.");
  const start = new Date(startsAt),
    end = new Date(+start + duration * 60000);
  if (
    !Number.isFinite(+start) ||
    +start < Date.now() + 60000 ||
    +start > Date.now() + 180 * 86400000 ||
    +start % (15 * 60000) !== 0
  )
    fail(400, "Choose a future quarter-hour slot within 180 days.");
  const local = localParts(start),
    finish = localParts(end);
  const hours = business.openingHours.get
    ? business.openingHours.get(String(local.day))
    : business.openingHours[String(local.day)];
  if (
    !hours ||
    business.closedDates.includes(local.date) ||
    !provider.weekdays.includes(local.day) ||
    local.date !== finish.date
  )
    fail(409, "Business or professional unavailable on this date.");
  const [open, close] = hours.split("-");
  if (
    local.clock < open ||
    finish.clock > close ||
    local.clock < provider.workStart ||
    finish.clock > provider.workEnd
  )
    fail(409, "Time is outside working hours.");
  return { start, end };
}
export async function expireHolds() {
  const now = new Date();
  const candidates = await Appointment.find({
    ...assignedScope,
    status: { $in: ["awaiting_payment", "pending_confirmation"] },
    holdExpiresAt: { $lte: now },
  })
    .select("_id")
    .limit(200);
  for (const { _id } of candidates)
    await tx(async (session) => {
      const app = await Appointment.findOne({
        _id,
        ...assignedScope,
        status: { $in: ["awaiting_payment", "pending_confirmation"] },
        holdExpiresAt: { $lte: now },
      }).session(session);
      if (!app) return;
      app.status = "cancelled";
      app.expired = true;
      app.cancellationReason = "Payment hold expired";
      await app.save({ session });
      await Slot.deleteMany(
        { appointment: _id, professional: app.professional },
        { session },
      );
      await Payment.updateMany(
        {
          appointment: _id,
          professional: app.professional,
          status: "awaiting_verification",
        },
        { $set: { status: "expired" } },
        { session },
      );
      await audit(
        undefined,
        "booking.expired",
        "Appointment",
        app._id,
        "System expired an unpaid booking hold",
        session,
        app.professional,
      );
      if (app.customer) await notify(
        app.customer,
        "Booking hold expired",
        `Booking ${app.reference} expired without verified payment.`,
        session,
        app.professional,
      );
    });
}
export async function reserve(input, actor) {
  await expireHolds();
  if (!["customer", "professional"].includes(actor.role))
    fail(403, "Only customers and professionals can book.");
  const service = await Service.findOne({
    _id: input.service,
    professional: input.professional,
    active: true,
  });
  const provider = await User.findOne({
    _id: input.professional,
    active: true,
    role: "professional",
  });
  if (!service || !provider) fail(404, "Service or professional unavailable.");
  if (
    actor.role === "professional" &&
    String(actor._id) !== String(input.professional)
  )
    fail(404, "Service or professional unavailable.");
  const business = await settings(provider._id);
  if (!business.whatsappNumber)
    fail(
      409,
      "This professional must complete a valid WhatsApp number before accepting bookings.",
    );
  if (actor.role === "customer" && !business.published)
    fail(404, "Professional unavailable.");
  if (input.policyVersion !== business.policyVersion)
    fail(409, "Booking policy changed. Review and accept the current policy.");
  const guest = actor.role === "professional" ? input.guestCustomer : undefined;
  if (guest && input.customer) fail(400, "Choose a registered customer or phone customer, not both.");
  const customer = actor.role === "customer" ? actor._id : input.customer;
  let bookingCustomerName = guest?.name || actor.name || "Customer";
  if (!guest) {
    if (!customer) fail(400, "Select a customer or enter phone booking details.");
    const person = await User.findOne({ _id: customer, role: "customer", active: true });
    if (!person) fail(400, "Select an active customer.");
    bookingCustomerName = person.name;

    // Professionals may only book registered customers already
    // associated with their own business.
    if (actor.role === "professional") {
      const relationship = await ProfessionalCustomer.exists({
        professional: actor._id,
        customer: person._id,
      });
      if (!relationship) fail(404, "Customer not found.");
    }
  }
  const { start, end } = validateTime(
    input.startsAt,
    service.durationMinutes,
    provider,
    business,
  );
  if (business.feeDeducted && business.bookingFeeLisente > service.priceLisente)
    fail(400, "Booking fee exceeds service price. Contact the salon.");
  return tx(async (session) => {
    const [app] = await Appointment.create(
      [
        {
          reference: `SAL-${randomBytes(12).toString("hex").toUpperCase()}`,
          ...(customer ? { customer } : {}),
          ...(guest ? { guestCustomer: guest } : {}),
          professional: provider._id,
          service: service._id,
          serviceName: service.name,
          durationMinutes: service.durationMinutes,
          startsAt: start,
          endsAt: end,
          priceLisente: service.priceLisente,
          feeLisente: business.bookingFeeLisente,
          totalLisente:
            service.priceLisente +
            (business.feeDeducted ? 0 : business.bookingFeeLisente),
          feeDeducted: business.feeDeducted,
          policyVersion: business.policyVersion,
          policyText: business.policyText,
          policyAcceptedAt: new Date(),
          holdExpiresAt: new Date(Date.now() + business.holdMinutes * 60000),
          notes: input.notes,
          status: "pending_confirmation",
        },
      ],
      { session },
    );
    if (customer) await ProfessionalCustomer.updateOne(
      { professional: provider._id, customer },
      { $setOnInsert: { professional: provider._id, customer } },
      { session, upsert: true },
    );
    if (guest) await GuestCustomer.updateOne(
      { professional: provider._id, phone: guest.phone },
      { $set: { name: guest.name } },
      { session, upsert: true },
    );
    await Slot.insertMany(
      slotsFor(start, end).map((minute) => ({
        professional: provider._id,
        minute,
        appointment: app._id,
      })),
      { session },
    );
    await audit(
      actor._id,
      "booking.created",
      "Appointment",
      app._id,
      app.reference,
      session,
      app.professional,
    );
    await notify(
      provider._id,
      "New booking request",
      `${app.reference}: ${bookingCustomerName} requested ${app.serviceName} for ${app.startsAt.toISOString()}. Booking fee ${app.feeLisente} lisente is arranged outside the website and must be manually verified before confirmation.`,
      session,
      provider._id,
    );
    if (customer) await notify(
      customer,
      "Booking request received",
      `${app.reference}: pending confirmation. Arrange the booking fee with the professional; payment is not recorded or confirmed by WhatsApp.`,
      session,
      app.professional,
    );
    return app;
  });
}
export async function availability(
  serviceId,
  professionalId,
  date,
  { allowUnpublished = false } = {},
) {
  await expireHolds();
  const [service, provider, business] = await Promise.all([
    Service.findOne({
      _id: serviceId,
      professional: professionalId,
      active: true,
    }),
    User.findOne({
      _id: professionalId,
      active: true,
      role: "professional",
    }),
    settings(professionalId),
  ]);
  if (!service || !provider || (!business.published && !allowUnpublished))
    fail(404, "Service or professional unavailable.");
  const start = new Date(`${date}T00:00:00+02:00`);
  const occupied = await Slot.find({
    professional: professionalId,
    minute: { $gte: +start / 60000, $lt: +start / 60000 + 1440 },
  }).lean();
  const set = new Set(occupied.map((s) => s.minute));
  const result = [];
  for (let minute = 0; minute < 1440; minute += 15) {
    const time = new Date(+start + minute * 60000);
    try {
      const { end } = validateTime(
        time,
        service.durationMinutes,
        provider,
        business,
      );
      if (slotsFor(time, end).every((m) => !set.has(m)))
        result.push(time.toISOString());
    } catch (error) {
      if (!(error instanceof BusinessError)) throw error;
    }
  }
  return result;
}
export function own(app, actor) {
  if (!app.professional) fail(404, "Appointment not found.");
  if (actor.role === "customer" && String(app.customer) === String(actor._id))
    return;
  if (
    actor.role === "professional" &&
    String(app.professional) === String(actor._id)
  )
    return;
  fail(actor.role === "admin" ? 403 : 404, "Appointment not found.");
}
export async function changeAppointment(id, input, actor) {
  await expireHolds();
  return tx(async (session) => {
    const app = await Appointment.findOne({
      _id: id,
      ...appointmentScope(actor),
    }).session(session);
    if (!app) fail(404, "Appointment not found.");
    own(app, actor);
    if (
      actor.role === "customer" &&
      ["start", "complete", "no_show"].includes(input.action)
    )
      fail(403, "Access denied.");
    const business = await settings(app.professional);
    if (["cancelled", "completed", "no_show"].includes(app.status))
      fail(409, "This appointment is closed.");
    if (
      actor.role === "customer" &&
      +app.startsAt - Date.now() < business.changeNoticeHours * 3600000
    )
      fail(
        409,
        "Contact the salon: the self-service change window has closed.",
      );
    if (input.action === "reschedule") {
      if (app.status === "in_progress" || +app.startsAt <= Date.now())
        fail(409, "An appointment that has started cannot be rescheduled.");
      const provider = await User.findOne({
        _id: app.professional,
        role: "professional",
      }).session(session);
      const { start, end } = validateTime(
        input.startsAt,
        app.durationMinutes,
        provider,
        business,
      );
      await Slot.deleteMany(
        { appointment: id, professional: app.professional },
        { session },
      );
      await Slot.insertMany(
        slotsFor(start, end).map((minute) => ({
          professional: app.professional,
          minute,
          appointment: app._id,
        })),
        { session },
      );
      app.startsAt = start;
      app.endsAt = end;
    } else if (input.action === "cancel") {
      if (app.status === "in_progress")
        fail(409, "An in-progress appointment cannot be cancelled.");
      app.status = "cancelled";
      app.cancellationReason = input.reason || "Cancelled by user";
      await Slot.deleteMany(
        { appointment: id, professional: app.professional },
        { session },
      );
      await Payment.updateMany(
        {
          appointment: id,
          professional: app.professional,
          status: "awaiting_verification",
        },
        { $set: { status: "cancelled" } },
        { session },
      );
    } else if (input.action === "start") {
      if (
        app.status !== "confirmed" ||
        +app.startsAt > Date.now() ||
        +app.endsAt <= Date.now()
      )
        fail(409, "Only a confirmed appointment within its scheduled time can start.");
      app.status = "in_progress";
    } else {
      const canComplete =
        input.action === "complete" &&
        (app.status === "in_progress" ||
          (app.status === "confirmed" && +app.endsAt <= Date.now()));
      const canMarkNoShow =
        input.action === "no_show" &&
        app.status === "confirmed" &&
        +app.endsAt <= Date.now();
      if (!canComplete && !canMarkNoShow)
        fail(
          409,
          "Complete an in-progress appointment, or mark a confirmed appointment no-show after its scheduled end.",
        );
      app.status = canComplete ? "completed" : "no_show";
      await Slot.deleteMany(
        { appointment: id, professional: app.professional },
        { session },
      );
    }
    await app.save({ session });
    await audit(
      actor._id,
      `booking.${input.action}`,
      "Appointment",
      id,
      input.reason,
      session,
      app.professional,
    );
    if (app.customer) await notify(
      app.customer,
      `Appointment ${input.action}`,
      `${app.reference}: ${input.action === "reschedule" ? "rescheduled to " + app.startsAt.toISOString() : app.status}.`,
      session,
      app.professional,
    );
    return app;
  });
}
export async function recordPayment(input, actor) {
  const professional = requireProfessional(actor);
  await expireHolds();
  return tx(async (session) => {
    const app = await Appointment.findOne({
      _id: input.appointment,
      professional,
    }).session(session);
    if (!app) fail(404, "Appointment not found.");
    if (["cancelled", "no_show"].includes(app.status))
      fail(409, "Cannot record payment for a cancelled or no-show booking.");
    const paid = await Payment.find({
      appointment: app._id,
      professional: app.professional,
      status: "paid",
    }).session(session);
    const received = paid.reduce((n, p) => n + p.amountLisente, 0);
    if (input.amountLisente > app.totalLisente - received)
      fail(409, "Amount exceeds outstanding balance.");
    if (
      input.kind === "booking_fee" &&
      (input.amountLisente !== app.feeLisente ||
        paid.some((p) => p.kind === "booking_fee"))
    )
      fail(
        409,
        "Booking fee must match the snapshot and can only be received once.",
      );
    if (
      input.kind === "balance" &&
      !["confirmed", "in_progress", "completed"].includes(app.status)
    )
      fail(409, "Verify the booking fee before recording the service balance.");
    if (
      await Payment.exists({
        appointment: app._id,
        professional,
        kind: input.kind,
        status: "awaiting_verification",
      }).session(session)
    )
      fail(409, "A payment of this kind is already awaiting review.");
    const [payment] = await Payment.create(
      [
        {
          ...input,
          professional,
          recordedBy: actor._id,
          status: "awaiting_verification",
        },
      ],
      { session },
    );
    if (input.kind === "booking_fee") app.status = "pending_confirmation"; // Writing the appointment serialises concurrent payment records.
    await app.save({ session });
    await Appointment.updateOne(
      { _id: app._id, professional: app.professional },
      { $inc: { revision: 1 } },
      { session },
    );
    await audit(
      actor._id,
      "payment.recorded",
      "Payment",
      payment._id,
      "Funds not yet verified",
      session,
      app.professional,
    );
    if (app.customer) await notify(
      app.customer,
      "Awaiting manual payment verification",
      `${app.reference}: payment record submitted; funds are not yet verified.`,
      session,
      app.professional,
    );
    return payment;
  });
}
export async function reviewPayment(id, input, actor) {
  const professional = requireProfessional(actor);
  await expireHolds();
  return tx(async (session) => {
    const payment = await Payment.findOne({ _id: id, professional }).session(
      session,
    );
    if (!payment) fail(404, "Payment not found.");
    if (payment.status !== "awaiting_verification")
      fail(409, "This payment is already closed.");
    const app = await Appointment.findOne({
      _id: payment.appointment,
      professional,
    }).session(session);
    if (
      !app ||
      ["cancelled", "no_show"].includes(app.status) ||
      (app.holdExpiresAt &&
        ["awaiting_payment", "pending_confirmation"].includes(app.status) &&
        +app.holdExpiresAt <= Date.now())
    )
      fail(
        409,
        "Booking is closed or expired. Do not confirm; reconcile funds manually.",
      );
    if (input.action === "verify" && payment.kind === "booking_fee") {
      if (payment.amountLisente !== app.feeLisente)
        fail(409, "Recorded booking fee does not match the appointment snapshot.");
      const expectedSlots = slotsFor(app.startsAt, app.endsAt).length;
      const heldSlots = await Slot.countDocuments({
        appointment: app._id,
        professional,
      }).session(session);
      if (
        app.status !== "pending_confirmation" ||
        (app.holdExpiresAt && +app.holdExpiresAt <= Date.now()) ||
        heldSlots !== expectedSlots
      )
        fail(409, "Booking is no longer eligible for confirmation. Reconcile any received funds manually.");
    }
    payment.reviewNote = input.note;
    if (input.action === "request_info") {
      await payment.save({ session });
      await audit(
        actor._id,
        "payment.information_requested",
        "Payment",
        id,
        input.note,
        session,
        app.professional,
      );
      if (app.customer) await notify(
        app.customer,
        "Payment information requested",
        `${app.reference}: ${input.note}`,
        session,
        app.professional,
      );
      return payment;
    }
    if (input.action === "reject") {
      payment.status = "rejected";
      if (payment.kind === "booking_fee") app.status = "awaiting_payment";
    } else {
      const paid = await Payment.find({
        appointment: app._id,
        professional,
        status: "paid",
      }).session(session);
      const received = paid.reduce((n, p) => n + p.amountLisente, 0);
      if (
        received + payment.amountLisente > app.totalLisente ||
        (payment.kind === "booking_fee" &&
          paid.some((p) => p.kind === "booking_fee"))
      )
        fail(409, "Payment would duplicate received income or exceed balance.");
      payment.status = "paid";
      payment.verifiedBy = actor._id;
      payment.verifiedAt = new Date();
      if (payment.kind === "booking_fee") {
        app.status = "confirmed";
        app.holdExpiresAt = undefined;
      }
    }
    await payment.save({ session });
    await app.save({ session });
    await Appointment.updateOne(
      { _id: app._id, professional: app.professional },
      { $inc: { revision: 1 } },
      { session },
    );
    await audit(
      actor._id,
      `payment.${input.action}`,
      "Payment",
      id,
      input.note,
      session,
      app.professional,
    );
    if (app.customer) {
      if (input.action === "verify" && payment.kind === "booking_fee") {
        const local = localParts(app.startsAt);
        const [customer, business] = await Promise.all([
          User.findById(app.customer).select("name").session(session),
          ProfessionalProfile.findOne({ professional: app.professional }).session(session),
        ]);
        await notify(
          app.customer,
          "Appointment confirmed",
          `Hello ${customer?.name || "Customer"}, your appointment is confirmed. Business: ${business?.salonName || "Professional"}. Service: ${app.serviceName}. Booking reference: ${app.reference}. Date and time: ${local.date} ${local.clock} (Africa/Maseru). Booking fee paid: M ${(payment.amountLisente / 100).toFixed(2)}. Status: Confirmed. Professional phone: ${business?.phone || "not provided"}. WhatsApp: ${business?.whatsappNumber || "not provided"}.`,
          session,
          app.professional,
        );
      } else {
        await notify(
          app.customer,
          input.action === "verify" ? "Payment received" : "Payment rejected",
          `${app.reference}: ${input.action === "verify" ? "funds independently verified by authorised personnel" : input.note}.`,
          session,
          app.professional,
        );
      }
    }
    return payment;
  });
}
export function financialSummary(payments, expenses, appointments) {
  const receivedLisente = payments
    .filter((p) => p.status === "paid")
    .reduce((n, p) => n + p.amountLisente, 0);
  const expenseLisente = expenses.reduce((n, p) => n + p.amountLisente, 0);
  const serviceValueLisente = appointments
    .filter((a) => !["cancelled", "no_show"].includes(a.status))
    .reduce((n, a) => n + a.totalLisente, 0);
  const popularity = Object.create(null);
  for (const a of appointments)
    if (!["cancelled", "no_show"].includes(a.status))
      popularity[a.serviceName] = (popularity[a.serviceName] || 0) + 1;
  const bookingFeeIncomeLisente = payments
    .filter((p) => p.status === "paid" && p.kind === "booking_fee")
    .reduce((n, p) => n + p.amountLisente, 0);
  const balanceIncomeLisente = payments
    .filter((p) => p.status === "paid" && p.kind === "balance")
    .reduce((n, p) => n + p.amountLisente, 0);
  const expenseTotals = Object.create(null);
  for (const expense of expenses)
    expenseTotals[expense.category] =
      (expenseTotals[expense.category] || 0) + expense.amountLisente;
  return {
    bookingFeeIncomeLisente,
    balanceIncomeLisente,
    expenseCategories: Object.entries(expenseTotals).map(
      ([category, amountLisente]) => ({ category, amountLisente }),
    ),
    receivedLisente,
    expenseLisente,
    profitLisente: receivedLisente - expenseLisente,
    bookedValueLisente: serviceValueLisente,
    popularity: Object.entries(popularity).map(([name, count]) => ({
      name,
      count,
    })),
  };
}
