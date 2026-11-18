import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("../../.local/group-demo-credentials.json", import.meta.url));
try {
  const credentials = JSON.parse(await fs.readFile(file, "utf8"));
  for (const [role, identity] of Object.entries(credentials)) {
    console.log(`${role}: ${identity.email}`);
  }
  console.log("Passwords are stored locally in .local/group-demo-credentials.json (mode 0600).");
  console.log("Retrieval command: cat .local/group-demo-credentials.json");
} catch {
  console.error("Demo credentials have not been created. Run the isolated demo once first.");
  process.exitCode = 1;
}
