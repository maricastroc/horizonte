import { notFound } from "next/navigation";
import Lab from "@/components/lab/Lab";

export default async function Page({ searchParams }: PageProps<"/lab">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { scene } = await searchParams;
  return <Lab initial={scene === "glass" ? "glass" : "tide"} />;
}
