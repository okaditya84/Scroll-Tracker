export interface ExtensionSettings {
  blocklist: string[];
  dataRetentionDays: number; // number of days to keep queued/local data
}

const STORAGE_KEY = 'scrollwise-settings';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  blocklist: [],
  dataRetentionDays: 30
};

const normalizeDomain = (domain: string) => {
  if (!domain) return '';
  let working = domain.trim().toLowerCase();
  if (!working) return '';
  if (!/^https?:\/\//.test(working)) {
    working = `https://${working}`;
  }
  try {
    const url = new URL(working);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return working
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .trim();
  }
};

const clampRetention = (value: number) => {
  const coerced = Number.isFinite(value) ? Math.round(value) : DEFAULT_SETTINGS.dataRetentionDays;
  return Math.max(1, Math.min(365, coerced));
};

const dedupe = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const mergeSettings = (base: ExtensionSettings, update: Partial<ExtensionSettings>): ExtensionSettings => {
  const merged: ExtensionSettings = {
    blocklist: base.blocklist,
    dataRetentionDays: base.dataRetentionDays
  };

  if (update.blocklist) {
    merged.blocklist = dedupe(update.blocklist.map(normalizeDomain).concat(base.blocklist)).filter(Boolean);
  }

  if (typeof update.dataRetentionDays !== 'undefined') {
    merged.dataRetentionDays = clampRetention(update.dataRetentionDays);
  }

  return {
    blocklist: dedupe(merged.blocklist.map(normalizeDomain)).filter(Boolean),
    dataRetentionDays: clampRetention(merged.dataRetentionDays)
  };
};

const writeSettings = async (settings: ExtensionSettings) => {
  const normalised = {
    blocklist: dedupe(settings.blocklist.map(normalizeDomain)).filter(Boolean),
    dataRetentionDays: clampRetention(settings.dataRetentionDays)
  } as ExtensionSettings;
  await chrome.storage.local.set({ [STORAGE_KEY]: normalised });
  return normalised;
};

export const getSettings = async (): Promise<ExtensionSettings> => {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const data = raw[STORAGE_KEY] as Partial<ExtensionSettings> | undefined;
  if (!data) {
    return DEFAULT_SETTINGS;
  }
  return {
    blocklist: dedupe((data.blocklist ?? DEFAULT_SETTINGS.blocklist).map(normalizeDomain)).filter(Boolean),
    dataRetentionDays: clampRetention(data.dataRetentionDays ?? DEFAULT_SETTINGS.dataRetentionDays)
  };
};

export const setSettings = async (settings: Partial<ExtensionSettings>) => {
  const current = await getSettings();
  const next = mergeSettings(current, settings);
  return writeSettings(next);
};

export const addToBlocklist = async (domain: string) => {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    return getSettings();
  }
  const current = await getSettings();
  if (current.blocklist.includes(normalized)) {
    return current;
  }
  return writeSettings({
    blocklist: [...current.blocklist, normalized],
    dataRetentionDays: current.dataRetentionDays
  });
};

export const removeFromBlocklist = async (domain: string) => {
  const normalized = normalizeDomain(domain);
  const current = await getSettings();
  if (!current.blocklist.includes(normalized)) {
    return current;
  }
  return writeSettings({
    blocklist: current.blocklist.filter(entry => entry !== normalized),
    dataRetentionDays: current.dataRetentionDays
  });
};

export const resetSettings = async () => writeSettings(DEFAULT_SETTINGS);

export default {
  getSettings,
  setSettings,
  addToBlocklist,
  removeFromBlocklist,
  resetSettings
};
