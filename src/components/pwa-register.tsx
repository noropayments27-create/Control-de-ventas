import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error: unknown) => {
        console.error("[PWA] No se pudo registrar el service worker:", error);
      });
  }, []);

  return null;
}
