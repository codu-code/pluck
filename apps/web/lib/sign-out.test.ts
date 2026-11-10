import { afterEach, expect, test, vi } from "vitest";
import { signOutHere } from "./sign-out";

vi.mock("./analytics", () => ({ forgetUser: vi.fn() }));

const removeItem = vi.fn();
function browser(fetch: () => Promise<Response>) {
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("localStorage", { removeItem });
  vi.stubGlobal("window", {});
}
afterEach(() => {
  vi.unstubAllGlobals();
  removeItem.mockClear();
});

test("a sign-out the server did not hear clears nothing and says so", async () => {
  browser(() => Promise.reject(new TypeError("offline")));
  expect(await signOutHere()).toBe(false);
  browser(() => Promise.resolve(new Response("", { status: 500 })));
  expect(await signOutHere()).toBe(false);
  expect(removeItem).not.toHaveBeenCalled();
});

test("a sign-out the server took clears this browser", async () => {
  browser(() => Promise.resolve(new Response("{}")));
  expect(await signOutHere()).toBe(true);
  expect(removeItem).toHaveBeenCalledWith("pluck:queue");
});
