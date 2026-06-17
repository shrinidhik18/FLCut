import { Suspense } from "react";
import { ExpiredContent } from "./ExpiredContent";

export default function ExpiredPage() {
  return (
    <Suspense fallback={null}>
      <ExpiredContent />
    </Suspense>
  );
}
