import { requireOptionalNativeModule } from "expo";

// The two home screen icons. "dark" is the alternate icon set app.config.ts adds; the light (forest) tile is the primary.
export type AppIcon = "light" | "dark";
const ALTERNATE = "AppIconDark";

const native = requireOptionalNativeModule<{ get(): Promise<string | null>; set(name: string | null): Promise<void> }>("AppIcon");

export const appIcons = {
  supported: native !== null,
  get: async (): Promise<AppIcon> => ((await native?.get()) === ALTERNATE ? "dark" : "light"),
  set: async (icon: AppIcon): Promise<void> => native?.set(icon === "dark" ? ALTERNATE : null),
};
