import { User, ProfessionalProfile } from "./models.js";
import { tx, audit, fail } from "./business.js";
export async function createProfessionalAccount(data, actor) {
  if (actor?.role !== "admin" || !actor.active)
    fail(403, "Only admin may create professional accounts.");
  const { whatsappNumber, ...account } = data;
  return tx(async (session) => {
    const [user] = await User.create(
      [{ ...account, role: "professional", createdBy: actor._id }],
      { session },
    );
    await ProfessionalProfile.create(
      [
        {
          professional: user._id,
          salonName: "Unpublished professional business",
          published: false,
          whatsappNumber,
        },
      ],
      { session },
    );
    await audit(
      actor._id,
      "professional.created",
      "User",
      user._id,
      "Platform account creation",
      session,
    );
    return user;
  });
}
