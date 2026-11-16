"use client";
import { Composer } from "@/components/studio/Composer";
import { Stage } from "@/components/studio/Stage";
import { History } from "@/components/studio/History";

export default function StudioPage() {
  return (
    <div className="studio">
      <Composer />
      <div className="studio-right">
        <Stage />
        <History />
      </div>
    </div>
  );
}
