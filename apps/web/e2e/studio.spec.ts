import { expect, test } from "@playwright/test";

// Each test starts from a clean slate: the app autosaves to localStorage, so a
// leftover diagram from a previous run would make these pass or fail at random.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
});

test("renders the sample diagram and opens a node's details", async ({ page }) => {
  const canvas = page.locator(".react-flow");
  await expect(canvas.getByText("Order Service")).toBeVisible();

  await canvas.getByText("Orders Database").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("campaign", { exact: true })).toBeVisible();
  await expect(dialog.getByText("gross_value")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("shows the request and response of an http node", async ({ page }) => {
  await page.locator(".react-flow").getByText("GET /v1/orders").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("/v1/orders", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Response")).toBeVisible();
  await expect(dialog.getByText(/"total"/)).toBeVisible();
});

test("switching flows changes what the canvas shows", async ({ page }) => {
  const canvas = page.locator(".react-flow");
  await expect(canvas.getByText("My Orders")).toBeVisible();
  await page.getByRole("button", { name: "CRM synchronisation" }).click();
  await expect(canvas.getByText("Partner CRM")).toBeVisible();
  await expect(canvas.getByText("My Orders")).toBeHidden();
});

test("a node typed into the editor appears on the canvas", async ({ page }) => {
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(
    'service Billing "Billing Service" {\n  desc: "Charges the customer"\n}\n' +
      'db BillingDB "Billing DB" {\n  table invoice {\n    id bigint [pk]\n  }\n}\n' +
      'flow Charge "Charge" {\n  Billing -> BillingDB : "write"\n}',
  );

  await expect(page.getByRole("button", { name: "Charge" })).toBeVisible();

  const canvas = page.locator(".react-flow");
  await expect(canvas.getByText("Billing Service")).toBeVisible();
});

test("a syntax error keeps the last valid diagram on screen", async ({ page }) => {
  const canvas = page.locator(".react-flow");
  await expect(canvas.getByText("Order Service")).toBeVisible();

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("service Broken {");

  await expect(page.getByText(/last valid diagram/i)).toBeVisible();
  await expect(canvas.getByText("Order Service")).toBeVisible();
});
