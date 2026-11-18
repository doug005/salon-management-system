import sharp from "sharp";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const accounts = JSON.parse(
  await readFile(
    new URL("../.local/multi-professional-accounts.json", import.meta.url),
    "utf8",
  ),
);
const home = {
  admin: "/admin",
  professional: "/professional",
  professional_two: "/professional",
  customer: "/account",
};
async function login(page, role) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(accounts[role].email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(accounts[role].password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  try {
    await expect(page).toHaveURL(new RegExp(home[role] + "$"));
  } catch (error) {
    const password = page.getByLabel("Password", { exact: true });
    if (await password.count()) await password.fill("");
    const email = page.getByLabel("Email address");
    if (await email.count()) await email.fill("");
    throw error;
  }
}
test("public professional directory and customer-only registration", async ({
  page,
}) => {
  await page.goto("/services");
  await expect(
    page.getByRole("heading", { name: "DEMO Signature styling", exact: true }),
  ).toHaveCount(2);
  await page.goto("/contact");
  await expect(
    page.getByRole("heading", { name: "DEMO Professional One", exact: true }),
  ).toBeVisible();
  await page.goto("/register");
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await page.getByLabel("Full name").fill("DEMO Browser Customer");
  await page
    .getByLabel("Email address")
    .fill(`migration-browser-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-browser-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/account$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/account$/);
});
test("admin account management has no financial workspace or verification controls", async ({
  page,
}) => {
  await login(page, "admin");
  await expect(
    page.getByRole("link", { name: "Accounts", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Payments", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/reports");
  await expect(
    page.getByRole("heading", { name: "Access restricted" }),
  ).toBeVisible();
  await page.goto("/admin/accounts");
  await expect(
    page.getByRole("heading", { name: "Create professional account" }),
  ).toBeVisible();
  await page.goto("/admin/settings");
  await expect(page.getByLabel("Platform name", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Booking fee (integer lisente)", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/professional");
  await expect(page).toHaveURL(/admin$/);
});
test("professionals manage own services, see independent lists, and cannot administer accounts", async ({
  page,
  browser,
}) => {
  await login(page, "professional");
  await page.goto("/professional/services");
  const name = "DEMO owned browser service " + Date.now();
  await page.getByRole("button", { name: "+ Add service", exact: true }).click();
  await page.getByLabel("Service name", { exact: true }).fill(name);
  await page.getByLabel("Duration (minutes, multiples of 15)").fill("30");
  await page.getByLabel("Price (integer lisente; 100 = M1)").fill("12000");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.goto("/admin/accounts");
  await expect(page).toHaveURL(/professional$/);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, "admin");
  await otherPage.goto("/admin/accounts");
  const isolatedEmail = `migration-isolated-${Date.now()}@example.test`;
  const isolatedPassword = "Synthetic-isolated-professional-123";
  await otherPage.getByLabel("Name", { exact: true }).fill("DEMO Isolated Browser Professional");
  await otherPage.getByLabel("Email", { exact: true }).fill(isolatedEmail);
  await otherPage.getByLabel("Initial password", { exact: true }).fill(isolatedPassword);
  await otherPage.getByRole("button", { name: "Create professional", exact: true }).click();
  await expect(otherPage.getByRole("status")).toContainText("Professional account created");
  await otherPage.getByRole("button", { name: "Log out", exact: true }).last().click();
  await otherPage.goto("/login");
  await otherPage.getByLabel("Email address").fill(isolatedEmail);
  await otherPage.getByLabel("Password", { exact: true }).fill(isolatedPassword);
  await otherPage.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(otherPage).toHaveURL(/\/professional$/);
  await otherPage.goto("/professional/services");
  await expect(
    otherPage.getByRole("heading", {
      name: "DEMO Signature styling",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    otherPage.getByRole("heading", { name, exact: true }),
  ).toHaveCount(0);
  await other.close();
});
test("professional uploads, previews, publishes and removes a service image", async ({ page, browser }) => {
  await login(page, "professional");
  await page.goto("/professional/services");
  const name = "DEMO image browser service " + Date.now();
  await page.getByRole("button", { name: "+ Add service", exact: true }).click();
  await page.getByLabel("Service name", { exact: true }).fill(name);
  await page.getByLabel("Duration (minutes, multiples of 15)").fill("30");
  await page.getByLabel("Price (integer lisente; 100 = M1)").fill("15000");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Edit record", exact: true }).click();
  await page.getByLabel("Upload or replace image").setInputFiles({
    name: "synthetic-service.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 24, height: 16, channels: 3, background: "#8866aa" },
    }).png().toBuffer(),
  });
  await expect(page.locator(".media-preview")).toBeVisible();
  const uploadResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "PUT" &&
    response.url().includes("/api/professional/services/") &&
    response.url().endsWith("/image"),
  );
  await page.getByRole("button", { name: "Save service image" }).click();
  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.status()).toBe(200);
  const uploadResult = await uploadResponse.json();
  expect(uploadResult.imageUrl).toMatch(
    /^\/api\/public\/services\/[a-f\d]{24}\/image$/i,
  );
  const preview = page.locator(".service-image-preview");
  await expect.poll(() => preview.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => preview.getAttribute("src")).toContain(uploadResult.imageUrl);
  const publicContext = await browser.newContext();
  const publicServicesResponse = await publicContext.request.get(
    "http://localhost:4000/api/public/services?limit=100",
  );
  expect(publicServicesResponse.status()).toBe(200);
  const publicServices = await publicServicesResponse.json();
  const publicService = publicServices.items.find((item) => item.name === name);
  expect(publicService?.imageUrl).toBe(uploadResult.imageUrl);
  const publicImageResponse = await publicContext.request.get(
    `http://localhost:4000${uploadResult.imageUrl}`,
  );
  expect(publicImageResponse.status()).toBe(200);
  expect(publicImageResponse.headers()["content-type"]).toContain("image/webp");
  expect((await publicImageResponse.body()).byteLength).toBeGreaterThan(0);
  const publicPage = await publicContext.newPage();
  await publicPage.goto("/services");
  const publicCard = publicPage.locator(".discovery-card").filter({ hasText: name });
  await expect(publicCard).toBeVisible();
  const publicImage = publicCard.locator("img");
  await expect(publicImage).toHaveCount(1);
  await publicImage.scrollIntoViewIfNeeded();
  await expect.poll(() => publicImage.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await publicContext.close();
  await page.getByRole("button", { name: "Remove image", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove image", exact: true })).toHaveCount(0);
});
test("customer selects a professional and only that professional can verify the manual fee", async ({
  page,
  browser,
}) => {
  await login(page, "customer");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Book a service", exact: true })
    .last()
    .click();
  await page
    .getByRole("combobox", { name: "Professional", exact: true })
    .selectOption({ label: "DEMO Professional One" });
  await page
    .getByRole("combobox", { name: "Service", exact: true })
    .selectOption({ label: "DEMO Signature styling · 60 min · M 250.00" });
  const day = new Date(Date.now() + 14 * 86400000);
  while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  await page
    .getByLabel("Date", { exact: true })
    .fill(day.toISOString().slice(0, 10));
  await expect(
    page
      .getByRole("combobox", { name: "Available time", exact: true })
      .locator("option"),
  ).not.toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Available time", exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel("I accept this professional's booking fee and policy.")
    .check();
  await page.getByRole("button", { name: "Request booking" }).click();
  await expect(
    page.getByRole("heading", { name: "Booking request received" }),
  ).toBeVisible();
  const reference = (await page.getByText(/Reference: SL-/).innerText())
    .split("Reference: ")[1]
    .trim();
  await page.goto("/account");
  await expect(
    page
      .getByRole("table", { name: "Upcoming appointments" })
      .getByText(reference, { exact: true }),
  ).toBeVisible();
  const context = await browser.newContext();
  const pro = await context.newPage();
  await login(pro, "professional");
  await expect(
    pro
      .getByRole("table", { name: "Upcoming bookings" })
      .getByText(reference, { exact: true }),
  ).toBeVisible();
  await pro.screenshot({
    path: ".local/dashboard-review/professional-upcoming-desktop.png",
    fullPage: true,
  });
  await pro.goto("/professional/payments");
  await pro
    .getByRole("combobox", { name: "Appointment", exact: true })
    .selectOption({ label: `${reference} · DEMO Signature styling` });
  await pro.getByLabel("Amount (integer lisente)").fill("5000");
  const receipt = "MIGRATION-E2E-" + Date.now();
  await pro.getByLabel("Unique receipt / transaction reference").fill(receipt);
  await pro
    .getByRole("button", { name: "Record awaiting verification" })
    .click();
  const row = pro
    .locator(".record")
    .filter({ has: pro.getByRole("heading", { name: receipt, exact: true }) });
  await expect(
    row.getByText("Awaiting Verification", { exact: true }),
  ).toBeVisible();
  await row
    .getByLabel("Review notes")
    .fill(
      "Synthetic fixture: professional independently reviewed demo receipt",
    );
  await row
    .getByRole("button", { name: "I independently verified received funds" })
    .click();
  await expect(row.getByText("Paid", { exact: true })).toBeVisible();
  await page.goto("/account/appointments");
  const booking = page.locator(".record").filter({
    has: page.getByRole("heading", { name: reference, exact: true }),
  });
  await expect(booking.getByText("Confirmed", { exact: true })).toBeVisible();
  await booking.getByRole("button", { name: "Cancel appointment" }).click();
  await expect(booking.getByText("Cancelled", { exact: true })).toBeVisible();
  await context.close();
});
test("mobile role-specific navigation keeps professional business and platform settings separate", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "professional");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  const nav = page.getByRole("navigation", { name: "Professional navigation" });
  await expect(
    nav.getByRole("link", { name: "Accounts", exact: true }),
  ).toHaveCount(0);
  await page.goto("/professional/settings");
  await expect(
    page.getByRole("heading", { name: "Your working availability" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("professional advertisement lifecycle and mobile public display", async ({
  page,
  browser,
}) => {
  await login(page, "professional");
  await page.goto("/professional/advertisements");
  const title = "DEMO browser promotion " + Date.now();
  await page.getByLabel("Advertisement title", { exact: true }).fill(title);
  await page
    .getByLabel("Advertisement description")
    .fill("Synthetic seven-day promotion");
  await page
    .getByRole("button", { name: "Create advertisement", exact: true })
    .click();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await expect(card).toContainText("Status: draft");
  await card.getByLabel(`Image for ${title}`).setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#9b7ab5" },
    })
      .png()
      .toBuffer(),
  });
  await expect(card).toContainText("Promotional image attached.");
  await card.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(card).toContainText("Status: published");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const publicPage = await context.newPage();
  await publicPage.goto("/");
  const publicCard = publicPage.locator("article").filter({
    has: publicPage.getByRole("heading", { name: title, exact: true }),
  });
  await expect(publicCard).toBeVisible();
  await expect(publicCard.locator("img")).toBeVisible();
  await expect
    .poll(() => publicCard.locator("img").evaluate((img) => img.naturalWidth))
    .toBeGreaterThan(0);
  await publicCard.getByRole("link", { name: "Professional profile" }).click();
  await expect(
    publicPage.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  expect(
    await publicPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const unpublishResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    response.url().endsWith("/unpublish"),
  );
  await card.getByRole("button", { name: "Unpublish", exact: true }).click();
  const unpublishResponse = await unpublishResponsePromise;
  expect(unpublishResponse.status()).toBe(200);
  expect((await unpublishResponse.json()).status).toBe("unpublished");
  await expect(card).toContainText("Status: unpublished");
  await publicPage.reload();
  await expect(
    publicPage.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0);
  await card.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(card).toContainText("Status: published");
  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(card).toHaveCount(0);
  await context.close();
});
