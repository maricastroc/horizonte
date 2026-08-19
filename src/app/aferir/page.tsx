import { notFound } from "next/navigation";
import Parity from "./Parity";

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Parity />;
}
