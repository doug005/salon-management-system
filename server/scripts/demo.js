import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import mongoose from "mongoose";
import { localDatabase, projectRoot } from "./local-db.js";
import {
  User,
  Service,
  ProfessionalProfile,
  Provision,
} from "../src/models.js";
import { createProfessionalAccount } from "../src/accounts.js";
import { prepareIndexes } from "../src/integrity.js";
import { seedGroupDemo } from "./seed-group-demo.js";
// Separate namespace and directory: historical single-salon demo is never migrated/reset.
const dataDirectory = ".local/multi-professional-data";
await mkdir(path.join(projectRoot, dataDirectory), { recursive: true });
await mkdir(path.join(projectRoot, ".local/tmp"), { recursive: true });
process.env.TMPDIR = path.join(projectRoot, ".local/tmp");
process.env.MONGOMS_RUNTIME_DOWNLOAD = "false";
const database = await localDatabase({
  dataDirectory,
  replicaName: "salonmulti",
});
await mongoose.connect(database.getUri("salon_multi_demo"));
await prepareIndexes();
await seedGroupDemo();
const filename = path.join(
  projectRoot,
  ".local/multi-professional-accounts.json",
);
let credentials;
try {
  credentials = JSON.parse(await readFile(filename, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  credentials = Object.fromEntries(
    ["admin", "professional", "professional_two", "customer"].map((key) => [
      key,
      {
        email: `${key.replace("_", "-")}@demo.example.test`,
        password: randomBytes(18).toString("base64url"),
      },
    ]),
  );
  await writeFile(filename, JSON.stringify(credentials, null, 2), {
    mode: 0o600,
    flag: "wx",
  });
}
let admin = await User.findOne({ email: credentials.admin.email });
if (!admin) {
  admin = await User.create({
    ...credentials.admin,
    name: "DEMO Platform Admin",
    role: "admin",
  });
  await Provision.create({ _id: "initial-admin", admin: admin._id });
}
if (admin.role !== "admin")
  throw new Error("Unexpected existing role; explicit migration is required.");
for (const [key, name] of [
  ["professional", "DEMO Professional One"],
  ["professional_two", "DEMO Professional Two"],
]) {
  let user = await User.findOne({ email: credentials[key].email });
  if (!user)
    user = await createProfessionalAccount(
      { ...credentials[key], name },
      admin,
    );
  if (user.role !== "professional")
    throw new Error(
      "Unexpected existing role; explicit migration is required.",
    );
  const profile = await ProfessionalProfile.findOne({ professional: user._id });
  if (profile.salonName === "Unpublished professional business") {
    profile.salonName = name;
    profile.published = true;
    await profile.save();
  }
  if (!(await Service.exists({ professional: user._id })))
    await Service.create({
      professional: user._id,
      name: "DEMO Signature styling",
      description: "Synthetic demonstration service; not a real offer.",
      durationMinutes: 60,
      priceLisente: 25000,
    });
}
if (!(await User.exists({ email: credentials.customer.email })))
  await User.create({
    ...credentials.customer,
    name: "DEMO Customer",
    role: "customer",
  });
await mongoose.disconnect();
const child = spawn(process.execPath, ["src/index.js"], {
  cwd: path.join(projectRoot, "server"),
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "development",
    MONGODB_URI: database.getUri("salon_multi_demo"),
    JWT_SECRET: randomBytes(48).toString("hex"),
    EMAIL_MODE: "safe",
    CLIENT_ORIGIN: "http://localhost:3000",
  },
});
console.log(
  "Isolated multi-professional demo ready. Generated accounts are in ignored .local/multi-professional-accounts.json; credentials are not logged. Legacy demo data is unchanged.",
);
let stopping;
function stop() {
  if (!stopping)
    stopping = (async () => {
      child.kill("SIGTERM");
      await database.stop();
    })();
  return stopping;
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("exit", async (code, signal) => {
  await stop();
  if (signal) console.error("Demo API stopped by signal:", signal);
  process.exit(code ?? (signal ? 1 : 0));
});
