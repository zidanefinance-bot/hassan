// Installable app: service worker, the "Install app" prompt, and push alerts on this device.
import { useEffect, useState } from "react";
import { api } from "./lib.jsx";

export const swSupported = () => "serviceWorker" in navigator;
export const pushSupported = () => swSupported() && "PushManager" in window && "Notification" in window;
export const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function registerServiceWorker() {
  if (!swSupported() || !import.meta.env.PROD) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

// Chrome/Edge/Android offer installing through this event; we keep it until the user taps "Install app"
let deferred = null;
const listeners = new Set();
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; listeners.forEach((f) => f()); });
window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((f) => f()); });

export function useInstall() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); listeners.add(f); return () => listeners.delete(f); }, []);
  return {
    canInstall: Boolean(deferred) && !isStandalone(),
    iosHint: isIOS() && !isStandalone(),
    installed: isStandalone(),
    install: async () => { if (!deferred) return false; deferred.prompt(); const r = await deferred.userChoice; deferred = null; listeners.forEach((f) => f()); return r.outcome === "accepted"; },
  };
}

const keyBytes = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export async function pushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush() {
  if (!pushSupported()) throw new Error(isIOS() ? "On iPhone, first add the app to your Home Screen, then open it from there and turn alerts on." : "This browser can't show push alerts.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Alerts are blocked. Allow notifications for this site in the browser settings.");
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const { key } = await api("/push/key");
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  await api("/push/subscribe", { method: "POST", body: { subscription: sub.toJSON() } });
  return sub;
}

export async function disablePush() {
  const sub = await pushSubscription();
  if (!sub) return;
  await api("/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}
