import type { Metadata } from "next";
import ConceptStrapStageClient from "@/components/ConceptStrapStageClient";

const title = "Watchstrapper Concept Stage";
const description = "Experimental concept route for the strap-stage preview flow.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/concept/strap-stage"
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nocache: true
    }
  },
  openGraph: {
    title,
    description,
    url: "https://watchstrapper.com/concept/strap-stage",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title,
    description
  }
};

export default function ConceptStrapStagePage() {
  return <ConceptStrapStageClient />;
}
