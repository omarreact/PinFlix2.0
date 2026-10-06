import { Suspense } from "react";
import TitleView from "@/components/TitleView";

export default function TitlePage() {
  return (
    <Suspense>
      <TitleView />
    </Suspense>
  );
}
