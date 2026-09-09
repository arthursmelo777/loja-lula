"use client";

import { useEffect } from "react";
import { captureFbclidFromLocation, captureUtmFromLocation } from "@/lib/utm";

export function UtmCapture() {
  useEffect(() => {
    captureUtmFromLocation();
    captureFbclidFromLocation();
  }, []);
  return null;
}
