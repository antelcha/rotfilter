import { DEFAULT_SETTINGS } from "../shared/constants";
import type { Settings } from "../shared/types";
import { hashText } from "../shared/hash";

const KEY = "settings";
const hashFilter = (showText: string, dontShowText: string) => hashText(`${showText}\u0000${dontShowText}`);
export async function getSettings(): Promise<Settings> {
  const stored = (await chrome.storage.local.get(KEY))[KEY] as (Partial<Settings> & { policyText?: string }) | undefined;
  const legacy = stored?.policyText;
  const { policyText: _drop, ...cleanStored } = stored ?? {};
  const settings = { ...DEFAULT_SETTINGS, ...cleanStored } as Settings;
  // One-time migration: the old single policy described what to hide.
  if (legacy && !settings.showText && !settings.dontShowText) settings.dontShowText = legacy;
  if (!settings.filterHash) settings.filterHash = await hashFilter(settings.showText, settings.dontShowText);
  return settings;
}
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...await getSettings(), ...patch };
  if (patch.showText !== undefined || patch.dontShowText !== undefined) next.filterHash = await hashFilter(next.showText, next.dontShowText);
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}
