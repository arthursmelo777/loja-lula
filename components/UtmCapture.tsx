"use client";

import { useEffect } from "react";
import { captureFbclidFromLocation, captureUtmFromLocation } from "@/lib/utm";
import { capturarCupomDaUrl } from "@/lib/cupons";

export function UtmCapture() {
  useEffect(() => {
    captureUtmFromLocation();
    capturarCupomDaUrl();
    captureFbclidFromLocation();
  }, []);
  return null;
}
