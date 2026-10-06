import { Suspense } from "react";
import BrowseView from "@/components/BrowseView";

export default function BrowsePage() {
  return (
    <Suspense>
      <BrowseView />
    </Suspense>
  );
}
