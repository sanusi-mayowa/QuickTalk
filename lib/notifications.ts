// Lightweight wrapper around expo-notifications with guarded dynamic import
let Notifications: any = null;

async function ensureModule() {
  if (!Notifications) {
    try {
      Notifications = (await import('expo-notifications')) as any;
    } catch (e) {
      console.warn('expo-notifications not available', e);
    }
  }
  return Notifications;
}

export async function requestPermissionsAsync() {
  const mod = await ensureModule();
  if (!mod) return { status: 'unavailable' } as any;
  const { status } = await mod.requestPermissionsAsync();
  return { status };
}

export async function setAndroidChannel() {
  const mod = await ensureModule();
  if (!mod) return;
  if (mod.setNotificationChannelAsync) {
    try {
      await mod.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: mod.AndroidImportance?.HIGH || 4,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        lockscreenVisibility: 1,
      });
    } catch {}
  }
}

export async function presentLocalNotificationAsync(params: {
  title: string;
  body: string;
  data?: Record<string, any>;
}) {
  const mod = await ensureModule();
  if (!mod) return;
  try {
    await mod.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: params.data || {},
        sound: 'default',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Failed to present notification', e);
  }
}

export default {
  requestPermissionsAsync,
  setAndroidChannel,
  presentLocalNotificationAsync,
};


