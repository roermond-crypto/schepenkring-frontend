import { apiRequest } from "@/lib/api/http";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getPushVapidPublicKey(): Promise<string | null> {
  try {
    const payload = await apiRequest<{ public_key?: string; vapid_public_key?: string }>({
      url: "/notifications/push/vapid-key",
      method: "GET",
    });
    return payload.public_key ?? payload.vapid_public_key ?? null;
  } catch {
    return null;
  }
}

export async function subscribeToPushNotifications(
  registration: ServiceWorkerRegistration,
): Promise<boolean> {
  if (!("PushManager" in window) || !("Notification" in window)) {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return false;
  }

  const vapidKey = await getPushVapidPublicKey();
  if (!vapidKey) {
    return false;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  await apiRequest({
    url: "/notifications/push/subscribe",
    method: "POST",
    data: subscription.toJSON(),
  });

  return true;
}

export async function unsubscribeFromPushNotifications(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await apiRequest({
    url: "/notifications/push/unsubscribe",
    method: "POST",
    data: { endpoint: subscription.endpoint },
  }).catch(() => null);

  await subscription.unsubscribe();
}
