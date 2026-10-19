"use client";

import dynamic from "next/dynamic";
import { DevCanvas } from "../dev-canvas";

/* DOAR PENTRU LUCRU — vezi ../dev-canvas.tsx. SE ȘTERGE după redesign. */
const Demo = dynamic(() => import("@/components/site/app-demos/art-install/demo"), { ssr: false });

export default function Page() {
  return <DevCanvas Demo={Demo} first="home" />;
}
