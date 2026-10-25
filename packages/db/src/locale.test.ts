import { expect, test } from "vitest";
import { getMe, updateSettings } from "./index.ts";
import { twoUsers } from "./testing.ts";

test("a language is kept on one account only, and none means follow the browser or phone", async () => {
  const { a, b } = await twoUsers();
  expect((await getMe(a))?.settings.locale).toBeNull();
  await updateSettings(a, { locale: "pt-BR" });
  expect((await getMe(a))?.settings.locale).toBe("pt-BR");
  expect((await getMe(b))?.settings.locale).toBeNull();
});
