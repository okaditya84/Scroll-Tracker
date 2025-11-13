import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/popup/styles.css';
import type { ExtensionSettings } from '@/storage/settings';
import { addToBlocklist, getSettings, removeFromBlocklist, resetSettings, setSettings } from '@/storage/settings';

type Banner = { variant: 'success' | 'error'; message: string } | null;

const RETENTION_MIN = 7;
const RETENTION_MAX = 180;
const WEB_URL = import.meta.env.VITE_WEB_URL ?? 'https://scrollwise.app';

const normaliseInputDomain = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase();
  }
};

const OptionsApp = () => {
  const [settings, setSettingsState] = useState<ExtensionSettings | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [retentionDraft, setRetentionDraft] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<Banner>(null);
  const [savingRetention, setSavingRetention] = useState(false);
  const [addingDomain, setAddingDomain] = useState(false);

  const refreshSettings = useCallback(async () => {
    const snapshot = await getSettings();
    setSettingsState(snapshot);
    setRetentionDraft(snapshot.dataRetentionDays);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (!banner) return undefined;
    const timeout = window.setTimeout(() => setBanner(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [banner]);

  const handleAddDomain = async () => {
    const normalised = normaliseInputDomain(domainInput);
    if (!normalised) {
      setBanner({ variant: 'error', message: 'Enter a valid domain (e.g. example.com).' });
      return;
    }

    if (settings?.blocklist.includes(normalised)) {
      setBanner({ variant: 'error', message: 'That domain is already blocked.' });
      return;
    }

    setAddingDomain(true);
    try {
      const updated = await addToBlocklist(normalised);
      setSettingsState(updated);
      setDomainInput('');
      setBanner({ variant: 'success', message: `Tracking disabled on ${normalised}` });
    } catch (error) {
      console.error('[scrollwise] add domain failed', error);
      setBanner({ variant: 'error', message: 'Unable to add domain. Try again.' });
    } finally {
      setAddingDomain(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    try {
      const updated = await removeFromBlocklist(domain);
      setSettingsState(updated);
      setBanner({ variant: 'success', message: `${domain} re-enabled for tracking` });
    } catch (error) {
      console.error('[scrollwise] remove domain failed', error);
      setBanner({ variant: 'error', message: 'Unable to remove domain. Try again.' });
    }
  };

  const handleSaveRetention = async () => {
    setSavingRetention(true);
    try {
      const updated = await setSettings({ dataRetentionDays: retentionDraft });
      setSettingsState(updated);
      setBanner({ variant: 'success', message: `Local data retention set to ${updated.dataRetentionDays} days` });
    } catch (error) {
      console.error('[scrollwise] retention update failed', error);
      setBanner({ variant: 'error', message: 'Unable to save retention preference.' });
    } finally {
      setSavingRetention(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset extension settings to defaults?')) {
      return;
    }
    try {
      const restored = await resetSettings();
      setSettingsState(restored);
      setRetentionDraft(restored.dataRetentionDays);
      setBanner({ variant: 'success', message: 'Settings restored to defaults.' });
    } catch (error) {
      console.error('[scrollwise] reset settings failed', error);
      setBanner({ variant: 'error', message: 'Unable to reset settings.' });
    }
  };

  const blocklist = settings?.blocklist ?? [];

  const blocklistDescription = useMemo(() => {
    if (!blocklist.length) {
      return 'Tracking is currently enabled for every site.';
    }
    return `${blocklist.length} ${blocklist.length === 1 ? 'site is' : 'sites are'} excluded from tracking.`;
  }, [blocklist.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Scrollwise" className="h-12 w-12 rounded-xl bg-slate-800/70 p-2 shadow" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">Scrollwise Settings</h1>
              <p className="text-sm text-slate-400">Tune what the extension collects and how long it keeps your local data.</p>
            </div>
          </div>
          <button
            onClick={() => chrome.tabs.create({ url: `${WEB_URL}/dashboard` }).catch(() => undefined)}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-700"
          >
            Open Dashboard
          </button>
        </header>

        {banner && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur transition ${
              banner.variant === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
            }`}
          >
            {banner.message}
          </div>
        )}

        <section className="grid gap-8 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <header className="mb-6 flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-white">Per-site blocklist</h2>
              <p className="text-sm text-slate-400">Exclude sensitive domains so Scrollwise ignores them entirely.</p>
            </header>

            <div className="mb-5 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={domainInput}
                onChange={event => setDomainInput(event.target.value)}
                placeholder="example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
              />
              <button
                onClick={handleAddDomain}
                disabled={addingDomain || !domainInput.trim()}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:bg-slate-600 disabled:text-slate-300"
              >
                {addingDomain ? 'Adding…' : 'Add domain'}
              </button>
            </div>

            <p className="mb-4 text-xs text-slate-500">{blocklistDescription}</p>

            <div className="space-y-2">
              {loading && (
                <div className="space-y-2">
                  {[0, 1, 2].map(index => (
                    <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-800/50" />
                  ))}
                </div>
              )}

              {!loading && blocklist.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-center text-sm text-slate-400">
                  No domains are blocked yet. Add any site you consider private or distracting.
                </div>
              )}

              {!loading && blocklist.length > 0 && (
                <ul className="grid gap-2">
                  {blocklist.map(entry => (
                    <li
                      key={entry}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-200"
                    >
                      <span className="truncate">{entry}</span>
                      <button
                        onClick={() => handleRemoveDomain(entry)}
                        className="text-xs font-medium text-slate-300 transition hover:text-rose-300"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>

          <article className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <header className="mb-6">
              <h2 className="text-xl font-semibold text-white">Local data retention</h2>
              <p className="text-sm text-slate-400">Scrollwise queues events locally before upload. Choose how long that queue may live.</p>
            </header>

            <div className="flex flex-1 flex-col gap-6">
              <div>
                <label className="mb-3 block text-xs font-medium uppercase tracking-wide text-slate-400">Retention window</label>
                <input
                  type="range"
                  min={RETENTION_MIN}
                  max={RETENTION_MAX}
                  value={retentionDraft}
                  onChange={event => setRetentionDraft(Number(event.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{RETENTION_MIN} days</span>
                  <span className="text-sm font-semibold text-white">{retentionDraft} days</span>
                  <span>{RETENTION_MAX} days</span>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Scrollwise automatically prunes anything older than your retention window from the local queue. Uploaded data lives safely in your account until you delete it.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSaveRetention}
                  disabled={savingRetention}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:bg-slate-600"
                >
                  {savingRetention ? 'Saving…' : 'Save retention'}
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
                >
                  Reset to defaults
                </button>
              </div>

              {settings && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                  <p className="font-medium text-slate-200">Current snapshot</p>
                  <p>{settings.blocklist.length} blocked {settings.blocklist.length === 1 ? 'domain' : 'domains'} · {settings.dataRetentionDays} day retention</p>
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400 shadow-lg">
          <h3 className="mb-2 text-base font-semibold text-white">Need to manage more?</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Use the web dashboard to export or delete your tracked history.</li>
            <li>Toggle tracking quickly from the popup, or pause it entirely when you need a break.</li>
            <li>Review our privacy note to understand how Scrollwise handles your data.</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

const container = document.getElementById('options');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <OptionsApp />
    </StrictMode>
  );
}
