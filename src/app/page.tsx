import Horizonte from "@/components/horizonte/Horizonte";

export default async function Home({ searchParams }: PageProps<"/">) {
  const query = await searchParams;
  return <Horizonte classic={"classic" in query} />;
}
