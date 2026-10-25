import { createHash, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

// playwright.config.ts turns on the App Review account for the e2e server with these two.
const EMAIL = "App-Review@example.test";
const PASSWORD = "e2e review password";
const REDIRECT = "http://127.0.0.1:4180/callback";

async function signInWithPassword(page: Page) {
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "That password did not work." })).toBeVisible();
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("the App Review account signs in with its password and lands in the Inbox", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await signInWithPassword(page);
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
});

// The iPhone app signs in through this page in a web sheet: the password must carry on with the OAuth request too.
test("a password sign-in carries on with the app's OAuth request", async ({ page, request }) => {
  const as = (await (await request.get("/.well-known/oauth-authorization-server/api/auth")).json()) as Record<string, string>;
  const reg = await request.post(as.registration_endpoint!, {
    data: { client_name: "Review AI", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code"], response_types: ["code"] },
  });
  const { client_id } = (await reg.json()) as { client_id: string };
  const authorize = new URL(as.authorization_endpoint!);
  for (const [k, v] of Object.entries({
    response_type: "code", client_id, redirect_uri: REDIRECT, state: "r1", scope: "library:read", code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(randomBytes(32).toString("base64url")).digest("base64url"),
  })) authorize.searchParams.set(k, v);

  await page.goto(authorize.toString());
  await expect(page).toHaveURL(/\/signin\?/);
  await signInWithPassword(page);
  await expect(page.getByRole("heading", { name: "Review AI wants to use your Pluck" })).toBeVisible();
});
