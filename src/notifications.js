import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const MORNING_ID = 4101;
const EVENING_ID = 4102;

export async function initializeNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.addListener('localNotificationActionPerformed', action => {
    const section = action.notification.extra?.section;
    if (section === 'morning' || section === 'evening') window.openAdhkarSection?.(section);
  });
  window.configureAdhkarNotifications = configureAdhkarNotifications;
  if (localStorage.getItem('adhkar-notifications-enabled') === 'true') {
    try { await configureAdhkarNotifications(true, localStorage.getItem('adhkar-morning-time') || '07:00', localStorage.getItem('adhkar-evening-time') || '17:00'); } catch (_) {}
  }
}

export async function configureAdhkarNotifications(enabled, morningTime, eveningTime) {
  if (!Capacitor.isNativePlatform()) throw new Error('Android only');
  await LocalNotifications.cancel({ notifications: [{ id: MORNING_ID }, { id: EVENING_ID }] });
  if (!enabled) return;
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') throw new Error('Notification permission denied');
  const parseTime = value => { const [hour, minute] = String(value || '').split(':').map(Number); if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error('Invalid time'); return { hour, minute }; };
  const morning = parseTime(morningTime); const evening = parseTime(eveningTime);
  await LocalNotifications.schedule({ notifications: [
    { id: MORNING_ID, title: 'حان وقت أذكار الصباح', body: 'ابدأ يومك بذكر الله. انقر لفتح أذكار الصباح.', schedule: { on: morning, allowWhileIdle: true }, extra: { section: 'morning' } },
    { id: EVENING_ID, title: 'حان وقت أذكار المساء', body: 'اختم يومك بذكر الله. انقر لفتح أذكار المساء.', schedule: { on: evening, allowWhileIdle: true }, extra: { section: 'evening' } }
  ] });
}
