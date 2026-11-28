import { LiveUpdate } from '@capawesome/capacitor-live-update';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const MANIFEST_URL = 'https://raw.githubusercontent.com/husamalaql/morning-evening-adhkar/main/live-update-manifest.json';
const APK_MANIFEST_URL = 'https://raw.githubusercontent.com/husamalaql/morning-evening-adhkar/main/apk-update-manifest.json';
let manifestCache = null;

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('انتهت مهلة الاتصال بخادم التحديثات');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getManifest(force = false) {
  if (manifestCache && !force) return manifestCache;
  const response = await fetchWithTimeout(MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store' });
  if (!response.ok) throw new Error('تعذر الاتصال بخادم التحديثات');
  const manifest = await response.json();
  if (!manifest.bundleId || !manifest.url || !manifest.checksum || !manifest.version) throw new Error('ملف التحديث غير صالح');
  manifestCache = manifest;
  return manifest;
}

function compareVersions(left, right) {
  const a = String(left).split('.').map(Number);
  const b = String(right).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] || 0) - (b[i] || 0);
    if (difference) return difference > 0 ? 1 : -1;
  }
  return 0;
}

async function hasUninstalledApkUpdate() {
  try {
    const [appInfo, response] = await Promise.all([
      App.getInfo(),
      fetchWithTimeout(APK_MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store' })
    ]);
    if (!response.ok) return true;
    const manifest = await response.json();
    return Boolean(manifest.version && compareVersions(manifest.version, appInfo.version) > 0);
  } catch (error) {
    // If update status cannot be verified, defer staged OTA activation until the next online check.
    console.warn('APK version check unavailable; deferring live update activation:', error);
    return true;
  }
}

export async function initializeLiveUpdates() {
  if (!isNativeAndroid()) return;
  try {
    if (await hasUninstalledApkUpdate()) {
      console.info('A newer APK is available; staged OTA activation is deferred until APK installation.');
    } else {
      const result = await LiveUpdate.ready();
      if (result.rollback) sessionStorage.setItem('adhkar-update-rolled-back', '1');
    }
  } catch (error) {
    console.error('Live update readiness error:', error);
  }
  window.checkAdhkarUpdate = checkForUpdate;
  window.applyAdhkarUpdate = applyUpdate;
  window.getAdhkarUpdateState = getUpdateState;
}

async function getUpdateState() {
  if (!isNativeAndroid()) return { status: 'unsupported' };
  const [manifest, current, next] = await Promise.all([
    getManifest(true),
    LiveUpdate.getCurrentBundle(),
    LiveUpdate.getNextBundle()
  ]);
  // The active bundle is authoritative; the plugin may retain the applied bundle as "next".
  if (current.bundleId === manifest.bundleId) return { status: 'current', version: manifest.version };
  if (next.bundleId === manifest.bundleId) return { status: 'pending', bundleId: next.bundleId, version: manifest.version };
  return { status: 'idle', version: manifest.version };
}

export async function checkForUpdate() {
  if (!isNativeAndroid()) return { status: 'unsupported' };
  const [manifest, appInfo, apkResponse] = await Promise.all([
    getManifest(true),
    App.getInfo(),
    fetchWithTimeout(APK_MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store' })
  ]);
  if (!apkResponse.ok) throw new Error('تعذر التحقق من إصدار APK');
  const apkManifest = await apkResponse.json();
  if (apkManifest.version && compareVersions(apkManifest.version, appInfo.version) > 0) {
    return { status: 'apk-required', version: apkManifest.version };
  }
  // APK compatibility is checked above; OTA bundle identity determines whether web assets need updating.
  const [current, next] = await Promise.all([
    LiveUpdate.getCurrentBundle(),
    LiveUpdate.getNextBundle()
  ]);
  // Check the active bundle before the staged bundle to avoid reinstalling an update.
  if (current.bundleId === manifest.bundleId) return { status: 'current', version: manifest.version };
  if (next.bundleId === manifest.bundleId) return { status: 'pending', bundleId: next.bundleId, version: manifest.version };
  window.updateAdhkarUpdateStatus?.('جارٍ تنزيل تحديث الواجهة...');
  let downloadTimeoutId;
  try {
    await Promise.race([
      LiveUpdate.downloadBundle({ url: manifest.url, bundleId: manifest.bundleId, checksum: manifest.checksum }),
      new Promise((_, reject) => {
        downloadTimeoutId = setTimeout(() => reject(new Error('استغرق تنزيل تحديث الواجهة وقتاً أطول من المتوقع')), 120000);
      })
    ]);
  } finally {
    clearTimeout(downloadTimeoutId);
  }
  await LiveUpdate.setNextBundle({ bundleId: manifest.bundleId });
  return { status: 'pending', bundleId: manifest.bundleId, version: manifest.version };
}

export async function applyUpdate() {
  if (!isNativeAndroid()) return;
  const next = await LiveUpdate.getNextBundle();
  if (!next.bundleId) throw new Error('لا يوجد تحديث جاهز للتطبيق');
  sessionStorage.setItem('adhkar-update-applied', '1');
  await LiveUpdate.reload();
}
