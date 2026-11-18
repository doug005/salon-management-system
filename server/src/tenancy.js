import {
  ProfessionalProfile,
  PlatformSettings,
  User,
  Appointment,
} from "./models.js";
export const ROLES = Object.freeze(["admin", "professional", "customer"]);
export const isCurrentRole = (role) => ROLES.includes(role);
export function requireProfessional(actor) {
  if (actor?.role !== "professional")
    throw Object.assign(new Error("Professional business access required."), {
      status: 403,
    });
  return actor._id;
}
export const businessScope = (actor) => ({
  professional: requireProfessional(actor),
});
export const assignedScope = { professional: { $type: "objectId" } };
export function appointmentScope(actor) {
  if (actor?.role === "professional") return businessScope(actor);
  if (actor?.role === "customer")
    return { customer: actor._id, ...assignedScope };
  throw Object.assign(
    new Error("Private appointments are not available to this role."),
    { status: 403 },
  );
}
export const platformSettings = () =>
  PlatformSettings.findOneAndUpdate(
    { key: "platform" },
    { $setOnInsert: { key: "platform" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
export function professionalSettings(professional) {
  if (!professional)
    throw Object.assign(new Error("Professional ownership is required."), {
      status: 400,
    });
  return ProfessionalProfile.findOneAndUpdate(
    { professional },
    { $setOnInsert: { professional } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}
export const publishedProfessionalIds = async () => {
  const active = await User.find({ role: "professional", active: true }).select(
    "_id",
  );
  return (
    await ProfessionalProfile.find({
      professional: { $in: active.map((u) => u._id) },
      published: true,
    }).select("professional")
  ).map((p) => p.professional);
};
// Public allowlist deliberately excludes internal profile/id/version metadata.
export function publicBusiness(profile) {
  if (!profile) return null;
  return {
    ...Object.fromEntries(
    [
      "professional",
      "salonName",
      "description",
      "demo",
      "currency",
      "timeZone",
      "whatsappNumber",
      "email",
      "phone",
      "address",
      "openingHours",
      "closedDates",
      "bookingFeeLisente",
      "feeDeducted",
      "holdMinutes",
      "policyVersion",
      "policyText",
      "changeNoticeHours",
      ].map((k) => [k, profile[k]]),
    ),
    photoUrl: profile.photo
      ? `/api/public/professionals/${profile.professional}/photo`
      : null,
  };
}

export async function paymentScope(actor) {
  const appointments = await Appointment.find(appointmentScope(actor)).select(
    "_id professional",
  );
  return appointments.length
    ? {
        $or: appointments.map((a) => ({
          appointment: a._id,
          professional: a.professional,
        })),
      }
    : { appointment: { $in: [] } };
}
