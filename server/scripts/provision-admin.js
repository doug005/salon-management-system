// Reads private admin account JSON from stdin. Never print passwords or setup tokens.
import { loadConfig } from "../src/config.js";
const config = loadConfig();
let text = "";
for await (const chunk of process.stdin) {
  text += chunk;
  if (text.length > 4096) throw new Error("Input too large");
}
try {
  const input = JSON.parse(text);
  const response = await fetch(
    `http://127.0.0.1:${config.PORT}/api/auth/provision-admin`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: config.CLIENT_ORIGIN,
      },
      body: JSON.stringify({ ...input, setupToken: config.ADMIN_SETUP_TOKEN }),
    },
  );
  if (!response.ok) throw new Error();
  console.log(
    "Initial admin provisioned. Sign in through the website. Remove ADMIN_SETUP_TOKEN from the private environment.",
  );
} catch {
  console.error(
    "Provisioning failed. Verify the local API, setup token, unused provisioning state and valid private account input. Credentials are not logged.",
  );
  process.exitCode = 1;
}
