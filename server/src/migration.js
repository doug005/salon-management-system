// Assessment only: no writes, document contents, amounts, identifiers or credentials emitted.
export async function assessMigration(db) {
  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();
  const names = new Set(collections.map((c) => c.name));
  const count = async (name, filter = {}) =>
    names.has(name) ? db.collection(name).countDocuments(filter) : 0;
  const roles = names.has("users")
    ? await db
        .collection("users")
        .aggregate([
          { $group: { _id: "$role", count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ])
        .toArray()
    : [];
  const records = {};
  for (const name of [
    "services",
    "appointments",
    "slots",
    "payments",
    "expenses",
  ])
    records[name] = {
      total: await count(name),
      unassigned: await count(name, {
        professional: { $not: { $type: "objectId" } },
      }),
    };
  const warnings = [];
  for (const [name, legacy] of [
    ["slots", "staff,minute"],
    ["payments", "method,reference"],
  ]) {
    if (!names.has(name)) continue;
    const indexes = await db.collection(name).indexes();
    if (
      indexes.some((i) => i.unique && Object.keys(i.key).join(",") === legacy)
    )
      warnings.push(
        `${name}: legacy global unique index retained; reviewed replacement may be needed for new scoped writes.`,
      );
  }
  return {
    mode: "read-only",
    schemaTarget: "multi-professional-v1",
    roles: roles.map((r) => ({ role: r._id, count: r.count })),
    records,
    legacyBusinessSettings: await count("businesssettings"),
    warnings,
    requiresExplicitMappings:
      roles.some((r) => ["owner", "staff"].includes(r._id)) ||
      Object.values(records).some((r) => r.unassigned > 0),
    applied: false,
  };
}
