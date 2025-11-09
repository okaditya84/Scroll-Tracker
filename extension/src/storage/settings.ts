export interface ExtensionSettings {
  blocklist: string[];
  dataRetentionDays: number; // number of days to keep queued/local data
}

const STORAGE_KEY = 'scrollwise-settings';

const DEFAULTS: ExtensionSettings = {
  blocklist: [],
  dataRetentionDays: 30
};

export const getSettings = async (): Promise<ExtensionSettings> => {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const data = raw[STORAGE_KEY] as Partial<ExtensionSettings> | undefined;
  return { ...DEFAULTS, ...(data ?? {}) };
};

export const setSettings = async (settings: Partial<ExtensionSettings>) => {
  const current = await getSettings();
  const next = { ...current, ...settings };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
};

export const addToBlocklist = async (domain: string) => {
  const settings = await getSettings();
  if (settings.blocklist.includes(domain)) return settings;
  const next = { ...settings, blocklist: [...settings.blocklist, domain] };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
};

export const removeFromBlocklist = async (domain: string) => {
  const settings = await getSettings();
  const next = { ...settings, blocklist: settings.blocklist.filter(d => d !== domain) };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
};

export default {
  getSettings,
  setSettings,
  addToBlocklist,
  removeFromBlocklist
};
