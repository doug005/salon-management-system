import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
export const id = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid record identifier");
export const amount = z.number().int().min(0).max(100000000);
export const password = z
  .string()
  .min(12)
  .refine(
    (v) => Buffer.byteLength(v, "utf8") <= 72,
    "Password must fit within 72 UTF-8 bytes",
  );
export const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
export const internationalWhatsApp = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((value, context) => {
    const parsed = parsePhoneNumberFromString(value, { extract: false });
    if (!parsed?.isValid()) {
      context.addIssue({ code: "custom", message: "Enter a valid international WhatsApp number, including country code." });
      return z.NEVER;
    }
    return parsed.number;
  });
export const profile = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .regex(/^[+\d ()-]{0,30}$/)
      .default(""),
  })
  .strict();
export const register = profile.extend({ email, password }).strict();
export const login = z
  .object({ email, password: z.string().min(1).max(200) })
  .strict();
export const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const safeUrl = z.union([
  z.literal(""),
  z.url().refine((s) => s.startsWith("https://"), "Use an HTTPS image URL"),
]);
export const service = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().max(2000).default(""),
    durationMinutes: z.number().int().min(15).max(480).multipleOf(15),
    priceLisente: amount,
    imageUrl: safeUrl.default(""),
    active: z.boolean().default(true),
  })
  .strict();
export const professionalAccount = register.extend({
  whatsappNumber: internationalWhatsApp,
});
export const accountStatus = z.object({ active: z.boolean() }).strict();
export const availabilityProfile = z
  .object({
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    workStart: clock,
    workEnd: clock,
  })
  .strict()
  .refine((v) => v.workEnd > v.workStart, "Work end must follow start");
export const platformSettings = z
  .object({
    platformName: z.string().trim().min(2).max(100),
    description: z.string().max(2000),
    demo: z.boolean(),
  })
  .strict();
export const settings = z
  .object({
    published: z.boolean().default(false),
    salonName: z.string().trim().min(2).max(100),
    description: z.string().max(2000),
    demo: z.boolean(),
    whatsappNumber: internationalWhatsApp,
    phone: z.string().max(50),
    email: z.union([z.literal(""), email]),
    address: z.string().max(500),
    openingHours: z.record(
      z.string().regex(/^[0-6]$/),
      z
        .string()
        .regex(/^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/)
        .refine(
          (v) => v.slice(0, 5) < v.slice(6),
          "Opening end must follow start",
        ),
    ),
    closedDates: z.array(z.iso.date()).max(366),
    bookingFeeLisente: amount.refine(
      (v) => v > 0,
      "A positive manually verified booking fee is required",
    ),
    feeDeducted: z.boolean(),
    holdMinutes: z.number().int().min(5).max(1440),
    policyText: z.string().min(20).max(3000),
    changeNoticeHours: z.number().int().min(0).max(168),
  })
  .strict();
export const booking = z
  .object({
    service: id,
    professional: id,
    customer: id.optional(),
    guestCustomer: z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().regex(/^[+\d ()-]{5,30}$/) }).strict().optional(),
    startsAt: z.iso.datetime({ offset: true }),
    acceptPolicy: z.literal(true),
    policyVersion: z.string().max(100),
    notes: z.string().max(1000).default(""),
  })
  .strict();
export const payment = z
  .object({
    appointment: id,
    amountLisente: amount.refine((v) => v > 0),
    method: z.enum(["cash", "bank_transfer", "mobile_money_manual", "mobile_money_agent"]),
    reference: z.string().trim().min(3).max(100),
    kind: z.enum(["booking_fee", "balance"]),
    evidenceUrl: safeUrl.default(""),
  })
  .strict();
export const expense = z
  .object({
    description: z.string().trim().min(2).max(500),
    category: z.enum([
      "products",
      "equipment",
      "rent",
      "electricity",
      "water",
      "other",
    ]),
    amountLisente: amount.refine((v) => v > 0),
    incurredAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).default(""),
});
export function parseId(value) {
  return id.parse(value);
}
