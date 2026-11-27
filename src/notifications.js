import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const IDS = { morning: 4101, evening: 4102 };
const DEFAULT_TIMES = { morning: '07:00', evening: '17:00' };
const todayKey = () => new Date().toLocaleDateString('en-CA');
const completedToday = section => localStorage.getItem('adhkar-completed-' + section) === todayKey();

function parseTime(value) {
  const parts = String(value || '').split(':').map(Number);
  const hour = parts[0], minute = parts[1];
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error('Invalid time');
  return { hour, minute };
}

function getTime(section) {
  const key = section === 'morning' ? 'adhkar-morning-time' : 'adhkar-evening-time';
  return localStorage.getItem(key) || DEFAULT_TIMES[section];
}

function nextOccurrence(section) {
  const time = parseTime(getTime(section));
  const now = new Date();
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.hour, time.minute, 0, 0);
  if (at <= now || completedToday(section)) at.setDate(at.getDate() + 1);
  return at;
}

function notificationFor(section, at) {
  const morning = section === 'morning';
  return {
    id: IDS[section],
    title: morning ? 'حان وقت أذكار الصباح' : 'حان وقت أذكار المساء',
    body: morning ? 'ابدأ يومك بذكر الله. افتح أذكار الصباح الآن.' : 'اختم يومك بذكر الله. افتح أذكار المساء الآن.',
    schedule: { at, allowWhileIdle: true },
    extra: { section },
    color: '#E9AFC7'
  };
}

async function scheduleSection(section) {
  await LocalNotifications.cancel({ notifications: [{ id: IDS[section] }] });
  await LocalNotifications.schedule({ notifications: [notificationFor(section, nextOccurrence(section))] });
}

async function refreshScheduledNotifications() {
  await scheduleSection('morning');
  await scheduleSection('evening');
}

export async function initializeNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.addListener('localNotificationActionPerformed', action => {
    const section = action.notification.extra?.section;
    if (section === 'morning' || section === 'evening') window.openAdhkarSection?.(section);
  });
  window.configureAdhkarNotifications = configureAdhkarNotifications;
  window.markAdhkarCompleted = markAdhkarCompleted;
  if (localStorage.getItem('adhkar-notifications-enabled') === 'true') {
    try { await refreshScheduledNotifications(); } catch (_) {}
  }
}

export async function configureAdhkarNotifications(enabled, morningTime, eveningTime) {
  if (!Capacitor.isNativePlatform()) throw new Error('Android only');
  await LocalNotifications.cancel({ notifications: [{ id: IDS.morning }, { id: IDS.evening }] });
  if (!enabled) return;
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') throw new Error('Notification permission denied');
  parseTime(morningTime);
  parseTime(eveningTime);
  localStorage.setItem('adhkar-morning-time', morningTime);
  localStorage.setItem('adhkar-evening-time', eveningTime);
  await refreshScheduledNotifications();
}

async function markAdhkarCompleted(section, completedDate) {
  if (!Capacitor.isNativePlatform() || !IDS[section]) return;
  localStorage.setItem('adhkar-completed-' + section, completedDate);
  await LocalNotifications.cancel({ notifications: [{ id: IDS[section] }] });
  if (localStorage.getItem('adhkar-notifications-enabled') !== 'true') return;
  const time = parseTime(getTime(section));
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const at = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), time.hour, time.minute, 0, 0);
  await LocalNotifications.schedule({ notifications: [notificationFor(section, at)] });
}
