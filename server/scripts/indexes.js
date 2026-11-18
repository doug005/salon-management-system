import mongoose from "mongoose";
import { loadConfig } from "../src/config.js";
import * as models from "../src/models.js";
const config = loadConfig();
try {
  await mongoose.connect(config.MONGODB_URI, { autoIndex: false });
  for (const model of Object.values(models)) {
    await model.createIndexes();
    console.log("Indexes verified:", model.modelName);
  }
} finally {
  await mongoose.disconnect();
}
