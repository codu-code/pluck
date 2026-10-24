import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { readList } from "@/lib/library";
import { ListView } from "./ListView";

export const metadata: Metadata = { title: "List · Pluck" };

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await currentUser())!;
  const data = await readList(user.id, (await params).id).catch(() => null);
  if (!data) notFound();
  return <ListView initial={data} />;
}
