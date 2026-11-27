import { LiveUpdate } from '@capawesome/capacitor-live-update';
import { Capacitor } from '@capacitor/core';

const MANIFEST_URL = 'https://raw.githubusercontent.com/husamalaql/morning-evening-adhkar/main/live-update-manifest.json';
let manifestCache = null;

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

async function getManifest(force = false) {
  if (manifestCache && !force) return manifestCache;
  const response = await fetch(MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store' });
  if (!response.ok) throw new Error('تعذر الاتصال بخادم التحديثات');
  const manifest = await response.json();
  if (!manifest.bundleId || !manifest.url) throw new Error('ملف التحديث غير صالح');
  manifestCache = manifest;
  return manifest;
}

export async function initializeLiveUpdates() {
  if (!isNativeAndroid()) return;
  try {
    const result = await LiveUpdate.ready();
    if (result.rollback) sessionStorage.setItem('adhkar-update-rolled-back', '1');
  } catch (error) {
    console.error('Live update readiness error:', error);
  }
  window.checkAdhkarUpdate = checkForUpdate;
  window.applyAdhkarUpdate = applyUpdate;
  window.getAdhkarUpdateState = getUpdateState;
}

async function getUpdateState() {
  if (!isNativeAndroid()) return { status: 'unsupported' };
  const next = await LiveUpdate.getNextBundle();
  if (next.bundleId) return { status: 'pending', bundleId: next.bundleId };
  return { status: 'idle' };
}

export async function checkForUpdate() {
  if (!isNativeAndroid()) return { status: 'unsupported' };
  const next = await LiveUpdate.getNextBundle();
  if (next.bundleId) return { status: 'pending', bundleId: next.bundleId };
  const manifest = await getManifest(true);
  const current = await LiveUpdate.getCurrentBundle();
  if (current.bundleId === manifest.bundleId) return { status: 'current' };
  await LiveUpdate.downloadBundle({ url: manifest.url, bundleId: manifest.bundleId });
  await LiveUpdate.setNextBundle({ bundleId: manifest.bundleId });
  return { status: 'pending', bundleId: manifest.bundleId };
}

export async function applyUpdate() {
  if (!isNativeAndroid()) return;
  const next = await LiveUpdate.getNextBundle();
  if (!next.bundleId) throw new Error('لا يوجد تحديث جاهز للتطبيق');
  sessionStorage.setItem('adhkar-update-applied', '1');
  await LiveUpdate.reload();
}
