import mongoose from "mongoose";
import { assessMigration } from "../src/migration.js";
try {
  if (!/^mongodb(\+srv)?:\/\//.test(process.env.MONGODB_URI || ""))
    throw new Error();
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10000,
  });
  console.log(
    JSON.stringify(await assessMigration(mongoose.connection.db), null, 2),
  );
} catch {
  console.error(
    "Read-only migration assessment failed. Check the authorised database configuration; credentials are not logged.",
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
