import { requireUser } from "@/lib/auth";
import { AddShared } from "./AddShared";

// Where a share lands when it was not plucked on arrival (../route.ts): the box, holding what was shared.
// A one-line box drops line breaks without a space, which would glue a link to the word before it.
export default async function ShareAdd({ searchParams }: { searchParams: Promise<{ text?: string | string[] }> }) {
  await requireUser();
  const { text } = await searchParams;
  return <AddShared text={typeof text === "string" ? text.replace(/\s*[\r\n]+\s*/g, " ") : ""} />;
}
