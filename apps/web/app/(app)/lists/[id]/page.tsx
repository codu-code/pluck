import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { me, readList } from "@/lib/library";
import { ListView } from "./ListView";

export const metadata: Metadata = { title: "List · Pluck" };

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await currentUser())!;
  const [data, profile] = await Promise.all([readList(user.id, (await params).id).catch(() => null), me(user.id)]);
  if (!data) notFound();
  return <ListView initial={data} handle={profile.handle} />;
}
