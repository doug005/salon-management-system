import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
const accounts = JSON.parse(
  await readFile(
    new URL("../.local/multi-professional-accounts.json", import.meta.url),
    "utf8",
  ),
);
const routes = {
  admin: ["", "accounts", "settings", "audit", "notifications", "profile"],
  professional: [
    "",
    "appointments",
    "customers",
    "services",
    "pending-confirmations",
    "payments",
    "expenses",
    "reports",
    "availability",
    "advertisements",
    "book",
    "settings",
    "notifications",
    "audit",
    "profile",
  ],
  customer: [
    "",
    "appointments",
    "history",
    "payments",
    "professionals",
    "book",
    "profile",
    "notifications",
  ],
};
const base = {
  admin: "/admin",
  professional: "/professional",
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
    await expect(page).toHaveURL(new RegExp(base[role] + "$"));
  } catch (error) {
    const password = page.getByLabel("Password", { exact: true });
    if (await password.count()) await password.fill("");
    const email = page.getByLabel("Email address");
    if (await email.count()) await email.fill("");
    throw error;
  }
}
for (const role of Object.keys(routes))
  test(`${role} dashboard desktop, mobile, navigation and accessibility`, async ({
    page,
  }) => {
    await mkdir(".local/dashboard-review", { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(page, role);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const nav = page.getByRole("navigation", {
      name:
        role === "customer"
          ? "Customer navigation"
          : role === "admin"
            ? "Admin navigation"
            : "Professional navigation",
    });
    await expect(nav).toBeVisible();
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect
      .poll(() => page.locator("main").innerText())
      .not.toContain("Loading…");
    if (role === "admin") {
      await expect(
        page.getByRole("heading", { name: "Platform health" }),
      ).toBeVisible();
      await expect(page.getByText("Available", { exact: true })).toBeVisible();
      await expect(
        nav.getByRole("link", { name: "Payments", exact: true }),
      ).toHaveCount(0);
      await expect(
        nav.getByRole("link", { name: "Advertisements", exact: true }),
      ).toHaveCount(0);
    }
    if (role === "professional")
      await expect(
        page.getByRole("heading", {
          name: "Today's appointments",
          exact: true,
        }),
      ).toBeVisible();
    if (role === "customer")
      await expect(
        page.getByRole("heading", {
          name: "Upcoming appointments",
          exact: true,
        }),
      ).toBeVisible();
    await page.screenshot({
      path: `.local/dashboard-review/${role}-desktop.png`,
      fullPage: true,
    });
    for (const section of routes[role].slice(1)) {
      let destination = nav.locator(`a[href="${base[role]}/${section}"]`);
      if ((await destination.count()) && await destination.isVisible()) {
        await destination.click();
      } else await page.goto(`${base[role]}/${section}`);
      await expect(page).toHaveURL(base[role] + "/" + section);
      if (role === "customer" && section === "history")
        await expect(
          page.getByRole("combobox", { name: "Status", exact: true }),
        ).toHaveValue("completed");
      await expect(page.getByRole("heading", { level: 1 }), {
        message: `${role}/${section} URL=${page.url()} body=${await page.locator("body").innerText()}`,
      }).toHaveCount(1);
      await expect(
        page.getByText("Access restricted", { exact: true }),
      ).toHaveCount(0);
      await expect
        .poll(() => page.locator("main").innerText())
        .not.toContain("Loading…");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base[role]);
    await expect(nav).toBeHidden();
    const toggle = page.getByRole("button", { name: "Toggle navigation" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(nav).toBeVisible();
    if (role !== "customer") {
      await nav.locator("details.workspace-more summary").click();
      await expect(
        nav.locator(`a[href="${base[role]}/${routes[role].at(-1)}"]`),
      ).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => ({
      tag: document.activeElement.tagName,
      outline: getComputedStyle(document.activeElement).outlineStyle,
    }));
    expect(focus.tag).not.toBe("BODY");
    expect(focus.outline).toBe("solid");
    await expect
      .poll(() => page.locator("main").innerText())
      .not.toContain("Loading…");
    await page.screenshot({
      path: `.local/dashboard-review/${role}-mobile.png`,
      fullPage: true,
    });
    for (const section of routes[role].slice(1)) {
      await toggle.click();
      let destination = nav.locator(`a[href="${base[role]}/${section}"]`);
      if (!(await destination.isVisible())) {
        await nav.locator("details.workspace-more summary").click();
        destination = nav.locator(`a[href="${base[role]}/${section}"]`);
      }
      await destination.click();
      await expect(nav).toBeHidden();
      await expect(page.locator("main")).toBeFocused();
      await expect
        .poll(() => page.locator("main").innerText())
        .not.toContain("Loading…");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(base[role]);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const font = await page
      .getByRole("heading", { level: 1 })
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).not.toContain("Georgia");
    expect(errors).toEqual([]);
  });

test("admin account table search and platform health failure are accessible", async ({
  page,
}) => {
  await login(page, "admin");
  await page
    .getByRole("link", { name: "Add Professional", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Invite a professional securely" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search", exact: true })
    .fill("DEMO Professional Two");
  await expect(
    page
      .getByRole("table", { name: "Platform accounts" })
      .getByRole("cell", { name: "DEMO Professional Two", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "Platform accounts" })
      .getByRole("cell", { name: "DEMO Professional One", exact: true }),
  ).toHaveCount(0);
  await page.route("**/api/health", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Synthetic health check unavailable" }),
    }),
  );
  await page.goto("/admin");
  await expect(page.getByRole("alert")).toContainText(
    "Synthetic health check unavailable",
  );
});

test("admin invites a synthetic professional without exposing a password or claiming email delivery", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/admin/accounts");
  const suffix = Date.now();
  await expect(page.getByRole("heading", { name: "Invite a professional securely" })).toBeVisible();
  await expect(page.getByLabel("Initial password")).toHaveCount(0);
  await expect(page.getByLabel("WhatsApp number (international)")).toHaveCount(0);
  await page
    .getByLabel("Professional email address", { exact: true })
    .fill(`ui-professional-${suffix}@example.test`);
  await page
    .getByRole("button", { name: "Send setup invitation", exact: true })
    .click();
  await expect(page.locator('p[role="status"]')).toContainText("no email was sent");
  await expect(
    page.getByRole("heading", { name: "Invite a professional securely" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search", exact: true }).fill(`ui-professional-${suffix}@example.test`);
  const row = page
    .getByRole("row")
    .filter({ hasText: `ui-professional-${suffix}@example.test` });
  await expect(
    row.getByRole("cell", { name: "professional", exact: true }),
  ).toBeVisible();
  await expect(row.getByText("Invitation pending · Active", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Resend secure setup invitation" })).toBeVisible();
  await row.getByRole("button", { name: "Deactivate account" }).click();
  await expect(
    row.getByText("Invitation pending · Inactive", { exact: true }),
  ).toBeVisible();
  await row.getByRole("button", { name: "Activate account" }).click();
  await expect(
    row.getByText("Invitation pending · Active", { exact: true }),
  ).toBeVisible();
});

test("login rate limit gives a readable message without implying downtime", async ({
  page,
}) => {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 429,
      contentType: "text/plain",
      body: "Too many requests",
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill("synthetic-limit@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-test-password-123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Too many attempts");
});
