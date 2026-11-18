import * as models from "./models.js";
export async function prepareIndexes(production = false) {
  if (!production) {
    await Promise.all(Object.values(models).map((model) => model.init()));
    return;
  }
  for (const [model, fields] of [
    [models.User, ["email"]],
    [models.AdvertisementLock, ["professional"]],
    [models.AdvertisementImage, ["key"]],
    [models.Session, ["tokenHash"]],
    [models.Appointment, ["reference"]],
    [models.Slot, ["professional", "minute"]],
    [models.Payment, ["professional", "method", "reference"]],
    [models.ProfessionalProfile, ["professional"]],
    [models.ProfessionalCustomer, ["professional", "customer"]],
    [models.PlatformSettings, ["key"]],
  ]) {
    const indexes = await model.collection.indexes();
    if (
      !indexes.some(
        (index) =>
          index.unique && Object.keys(index.key).join(",") === fields.join(","),
      )
    )
      throw new Error(
        "Required multi-professional integrity index missing. Run reviewed additive index provisioning.",
      );
  }
}
