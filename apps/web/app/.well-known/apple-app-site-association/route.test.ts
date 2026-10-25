import { afterEach, expect, test } from "vitest";
import { GET } from "./route";

afterEach(() => void delete process.env.APPLE_TEAM_ID);

test("no team, no file: links stay on the web; with one, shared, list and item links open the app", async () => {
  expect(GET().status).toBe(404);
  process.env.APPLE_TEAM_ID = "ABCDE12345";
  const body = await GET().json();
  expect(body.applinks.details[0].appIDs).toEqual(["ABCDE12345.io.getpluck.app"]);
  expect(body.applinks.details[0].components.map((c: { "/": string }) => c["/"])).toEqual(["/shared/*", "/lists/*", "/items/*"]);
});
