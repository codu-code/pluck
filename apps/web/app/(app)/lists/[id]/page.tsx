import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { HOST, requireUser } from "@/lib/auth";
import { me, peopleOf, readList } from "@/lib/library";
import { ListView } from "./ListView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.meta"))("list") };
}

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = (await params).id;
  const [data, profile, people] = await Promise.all([readList(user.id, id).catch(() => null), me(user.id), peopleOf(user.id, id).catch(() => [])]);
  if (!data) notFound();
  return <ListView initial={data} handle={profile.handle} host={HOST} people={people} />;
}
