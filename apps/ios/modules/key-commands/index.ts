import { requireOptionalNativeModule, type EventSubscription } from "expo";

// Hardware keyboard shortcuts (modules/key-commands/ios): UIKeyCommands with titles, so iPadOS lists them when ⌘ is
// held. `typing: false` steps a command aside while a text field is being edited (single letters, ⌘V, the arrows).
export type KeyCommand = {
  id: string;
  input: string; // a character, or "escape", "up", "down", "return"
  modifiers?: ("command" | "shift" | "control" | "option")[];
  title: string;
  typing?: boolean;
};

type Native = {
  set(commands: KeyCommand[]): Promise<void>;
  addListener(event: "onKeyCommand", listener: (e: { id: string }) => void): EventSubscription;
};
const native = requireOptionalNativeModule<Native>("KeyCommands");

export const keyCommands = {
  supported: native !== null,
  set: (commands: KeyCommand[]) => native?.set(commands) ?? Promise.resolve(),
  listen: (fn: (id: string) => void) => native?.addListener("onKeyCommand", (e) => fn(e.id)) ?? { remove() {} },
};
