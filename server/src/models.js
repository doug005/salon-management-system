import mongoose from "mongoose";
import bcrypt from "bcrypt";
const { Schema, model } = mongoose;
const ref = (name, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required,
});
const money = {
  type: Number,
  required: true,
  min: 0,
  max: 100000000,
  validate: Number.isSafeInteger,
};
const options = { timestamps: true, strict: "throw" };
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, default: "" },
    googleSub: { type: String, unique: true, sparse: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["admin", "professional", "customer"],
      default: "customer",
    },
    createdBy: ref("User", false),
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    weekdays: { type: [Number], default: [1, 2, 3, 4, 5, 6] },
    workStart: { type: String, default: "09:00" },
    workEnd: { type: String, default: "17:00" },
    canVerifyPayments: { type: Boolean, default: false },
  },
  options,
);
userSchema.pre("save", async function () {
  if (this.isModified("password"))
    this.password = await bcrypt.hash(this.password, 12);
});
userSchema.methods.comparePassword = function (value) {
  return bcrypt.compare(value, this.password);
};
export const User = model("User", userSchema);
export const Session = model(
  "Session",
  new Schema(
    {
      user: ref("User"),
      userVersion: { type: Number, required: true, default: 0 },
      tokenHash: { type: String, unique: true, required: true },
      expiresAt: { type: Date, required: true, index: { expires: 0 } },
    },
    options,
  ),
);
export const Provision = model(
  "Provision",
  new Schema(
    {
      _id: { type: String },
      owner: ref("User", false),
      admin: ref("User", false),
    },
    options,
  ),
);
export const Service = model(
  "Service",
  new Schema(
    {
      professional: ref("User"),
      name: { type: String, required: true, maxlength: 100 },
      description: { type: String, maxlength: 2000 },
      durationMinutes: {
        type: Number,
        required: true,
        min: 15,
        max: 480,
        validate: (v) => Number.isInteger(v) && v % 15 === 0,
      },
      priceLisente: money,
      imageUrl: { type: String, default: "" },
      image: ref("BusinessMedia", false),
      active: { type: Boolean, default: true },
    },
    options,
  ),
);
const appointmentSchema = new Schema(
  {
    revision: { type: Number, default: 0 },
    reference: { type: String, unique: true, required: true },
    customer: ref("User", false),
    guestCustomer: { name: { type: String, maxlength: 100 }, phone: { type: String, maxlength: 30 } },
    professional: ref("User"),
    staff: ref("User", false),
    service: ref("Service"),
    serviceName: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    timeZone: {
      type: String,
      enum: ["Africa/Maseru"],
      default: "Africa/Maseru",
    },
    status: {
      type: String,
      enum: [
        "awaiting_payment",
        "pending_confirmation",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      default: "awaiting_payment",
    },
    priceLisente: money,
    feeLisente: money,
    totalLisente: money,
    feeDeducted: { type: Boolean, required: true },
    policyVersion: { type: String, required: true },
    policyText: { type: String, required: true },
    policyAcceptedAt: { type: Date, required: true },
    holdExpiresAt: Date,
    expired: { type: Boolean, default: false },
    notes: { type: String, maxlength: 1000 },
    cancellationReason: String,
  },
  options,
);
appointmentSchema.pre("validate", function () {
  if (this.endsAt <= this.startsAt)
    this.invalidate("endsAt", "Must be after startsAt");
});
appointmentSchema.index({ professional: 1, startsAt: 1, endsAt: 1 });
appointmentSchema.index({ customer: 1, startsAt: -1 });
export const Appointment = model("Appointment", appointmentSchema);
export const Slot = model(
  "Slot",
  new Schema(
    {
      professional: ref("User"),
      staff: ref("User", false),
      minute: { type: Number, required: true },
      appointment: ref("Appointment"),
    },
    options,
  ),
);
Slot.schema.index(
  { professional: 1, minute: 1 },
  {
    unique: true,
    partialFilterExpression: { professional: { $type: "objectId" } },
  },
);
const paymentSchema = new Schema(
  {
    professional: ref("User"),
    appointment: ref("Appointment"),
    amountLisente: money,
    currency: { type: String, enum: ["LSL"], default: "LSL" },
    method: {
      type: String,
      enum: ["cash", "bank_transfer", "mobile_money_manual"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "unpaid",
        "awaiting_verification",
        "paid",
        "failed",
        "cancelled",
        "expired",
        "rejected",
      ],
      default: "awaiting_verification",
    },
    kind: { type: String, enum: ["booking_fee", "balance"], required: true },
    recordedBy: ref("User"),
    verifiedBy: ref("User", false),
    verifiedAt: Date,
    reference: { type: String, required: true, maxlength: 100 },
    evidenceUrl: { type: String, default: "" },
    reviewNote: String,
  },
  options,
);
paymentSchema.index(
  { professional: 1, method: 1, reference: 1 },
  {
    unique: true,
    partialFilterExpression: { professional: { $type: "objectId" } },
  },
);
paymentSchema.pre("validate", function () {
  if (this.status === "paid" && (!this.verifiedBy || !this.verifiedAt))
    this.invalidate("verifiedBy", "Manual verifier and timestamp required");
});
export const Payment = model("Payment", paymentSchema);
export const Expense = model(
  "Expense",
  new Schema(
    {
      professional: ref("User"),
      description: { type: String, required: true, maxlength: 500 },
      category: {
        type: String,
        enum: [
          "products",
          "equipment",
          "rent",
          "electricity",
          "water",
          "other",
        ],
        required: true,
      },
      amountLisente: money,
      incurredAt: { type: Date, required: true },
      recordedBy: ref("User"),
    },
    options,
  ),
);
const settingsSchema = new Schema(
  {
    key: {
      type: String,
      enum: ["business"],
      default: "business",
      unique: true,
    },
    salonName: { type: String, required: true, default: "Demonstration Salon" },
    description: {
      type: String,
      default:
        "Synthetic demonstration business. Replace with your salon details.",
    },
    demo: { type: Boolean, default: true },
    currency: { type: String, enum: ["LSL"], default: "LSL" },
    timeZone: {
      type: String,
      enum: ["Africa/Maseru"],
      default: "Africa/Maseru",
    },
    whatsappNumber: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    openingHours: {
      type: Map,
      of: String,
      default: {
        1: "09:00-17:00",
        2: "09:00-17:00",
        3: "09:00-17:00",
        4: "09:00-17:00",
        5: "09:00-17:00",
        6: "09:00-14:00",
      },
    },
    closedDates: { type: [String], default: [] },
    bookingFeeLisente: { ...money, default: 5000 },
    feeDeducted: { type: Boolean, default: true },
    holdMinutes: { type: Number, default: 60, min: 5, max: 1440 },
    policyVersion: { type: String, default: "1" },
    policyText: {
      type: String,
      default:
        "Demonstration policy: the booking fee is non-refundable once independently verified. Contact the salon to arrange a change.",
    },
    changeNoticeHours: { type: Number, default: 24, min: 0, max: 168 },
  },
  options,
);
export const BusinessSettings = model("BusinessSettings", settingsSchema);
export const Notification = model(
  "Notification",
  new Schema(
    {
      scope: {
        type: String,
        enum: ["personal", "platform", "business"],
        required: true,
        default: "personal",
      },
      professional: ref("User", false),
      recipient: ref("User"),
      title: { type: String, required: true },
      message: { type: String, required: true },
      channel: { type: String, enum: ["email", "in_app"], default: "email" },
      status: {
        type: String,
        enum: ["pending", "read", "sent", "failed", "simulated"],
        default: "pending",
      },
      attempts: { type: Number, default: 0 },
      lastError: String,
      readAt: Date,
      lockedAt: Date,
    },
    options,
  ),
);
export const Audit = model(
  "Audit",
  new Schema(
    {
      scope: { type: String, enum: ["platform", "business"], required: true },
      professional: ref("User", false),
      actor: ref("User", false),
      action: { type: String, required: true },
      entity: { type: String, required: true },
      entityId: { type: String, required: true },
      details: { type: String, maxlength: 2000 },
    },
    options,
  ),
);

// Separate new business profiles from the preserved legacy singleton collection.
const professionalProfileSchema = settingsSchema.clone();
professionalProfileSchema.remove("key");
professionalProfileSchema.clearIndexes();
professionalProfileSchema.add({
  professional: { ...ref("User"), unique: true },
  published: { type: Boolean, default: false },
  photo: ref("BusinessMedia", false),
});
export const ProfessionalProfile = model(
  "ProfessionalProfile",
  professionalProfileSchema,
);
export const GuestCustomer = model("GuestCustomer", new Schema({
  professional: ref("User"),
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
}, options));
GuestCustomer.schema.index({ professional: 1, phone: 1 }, { unique: true });
export const ProfessionalCustomer = model(
  "ProfessionalCustomer",
  new Schema({ professional: ref("User"), customer: ref("User") }, options),
);
ProfessionalCustomer.schema.index(
  { professional: 1, customer: 1 },
  { unique: true },
);
export const PlatformSettings = model(
  "PlatformSettings",
  new Schema(
    {
      key: {
        type: String,
        default: "platform",
        enum: ["platform"],
        unique: true,
      },
      platformName: {
        type: String,
        default: "Demonstration Salon Platform",
        required: true,
      },
      description: {
        type: String,
        default: "Demonstration multi-professional platform.",
      },
      demo: { type: Boolean, default: true },
      currency: { type: String, enum: ["LSL"], default: "LSL" },
      timeZone: {
        type: String,
        enum: ["Africa/Maseru"],
        default: "Africa/Maseru",
      },
      advertisementDurationDays: { type: Number, enum: [7], default: 7 },
    },
    options,
  ),
);
const advertisementSchema = new Schema(
  {
    professional: ref("User"),
    title: { type: String, required: true, maxlength: 100 },
    body: { type: String, maxlength: 2000 },
    imageUrl: String,
    image: ref("AdvertisementImage", false),
    status: {
      type: String,
      enum: ["draft", "published", "unpublished", "expired"],
      default: "draft",
    },
    startsAt: Date,
    endsAt: Date,
    video: ref("AdvertisementImage", false),
    moderatedBy: ref("User", false),
    moderatedAt: Date,
    moderationNote: { type: String, maxlength: 500 },
  },
  options,
);
advertisementSchema.pre("validate", function () {
  if (
    this.status === "published" &&
    (!this.startsAt ||
      !this.endsAt ||
      +this.endsAt - +this.startsAt !== 7 * 86400000)
  )
    this.invalidate(
      "endsAt",
      "Publication requires a server-controlled seven-day window.",
    );
});
advertisementSchema.index({ professional: 1, status: 1 });
advertisementSchema.index({ status: 1, startsAt: 1, endsAt: 1 });
export const Advertisement = model("Advertisement", advertisementSchema);

export const BusinessMedia = model(
  "BusinessMedia",
  new Schema(
    {
      professional: ref("User"),
      kind: { type: String, enum: ["profile", "service"], required: true },
      key: { type: String, required: true, unique: true },
      state: {
        type: String,
        enum: ["staged", "ready", "deleting"],
        default: "staged",
      },
      mimeType: { type: String, enum: ["image/webp"], default: "image/webp" },
    },
    options,
  ),
);

export const AdvertisementImage = model(
  "AdvertisementImage",
  new Schema(
    {
      professional: ref("User"),
      key: { type: String, required: true, unique: true },
      mimeType: {
        type: String,
        enum: ["image/webp", "video/mp4", "video/webm"],
        default: "image/webp",
      },
      state: {
        type: String,
        enum: ["staged", "ready", "deleting"],
        default: "staged",
      },
      failureCount: { type: Number, default: 0 },
      lastFailureAt: Date,
    },
    options,
  ),
);
export const AdvertisementLock = model(
  "AdvertisementLock",
  new Schema(
    {
      professional: { ...ref("User"), unique: true },
      revision: { type: Number, default: 0 },
    },
    options,
  ),
);
