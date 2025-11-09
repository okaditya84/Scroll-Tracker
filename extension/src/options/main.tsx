import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getSettings, setSettings, addToBlocklist, removeFromBlocklist } from '@/storage/settings';

const Options = () => {
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [domain, setDomain] = useState('');
  const [retention, setRetention] = useState(30);

  useEffect(() => {
    void getSettings().then(s => {
      setBlocklist(s.blocklist || []);
      setRetention(s.dataRetentionDays || 30);
    });
  }, []);

  const handleAdd = async () => {
    if (!domain) return;
    const next = await addToBlocklist(domain.trim().replace(/^https?:\/\//, '').replace(/^www\./, ''));
    setBlocklist(next.blocklist);
    setDomain('');
  };

  const handleRemove = async (d: string) => {
    const next = await removeFromBlocklist(d);
    setBlocklist(next.blocklist);
  };

  const handleRetention = async () => {
    const next = await setSettings({ dataRetentionDays: Number(retention) });
    setRetention(next.dataRetentionDays);
  };

  return (
    <main style={{ padding: 24, fontFamily: 'Inter, sans-serif', color: '#0f172a' }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Scrollwise Extension Settings</h1>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Per-site blocklist</h2>
        <p style={{ color: '#475569', marginBottom: 8 }}>Add domains to prevent tracking on specific sites (e.g. banking or private pages).</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="example.com" />
          <button onClick={handleAdd}>Add</button>
        </div>
        <ul>
          {blocklist.map(d => (
            <li key={d} style={{ marginBottom: 6 }}>
              {d} <button onClick={() => handleRemove(d)}>Remove</button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Data retention</h2>
        <p style={{ color: '#475569', marginBottom: 8 }}>How many days to keep queued/local data before automatic cleanup.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="number" value={retention} onChange={e => setRetention(Number(e.target.value))} style={{ width: 80 }} />
          <button onClick={handleRetention}>Save</button>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Notes</h2>
        <p style={{ color: '#475569' }}>Use the web dashboard for account-level settings, data export, and deletion.</p>
      </section>
    </main>
  );
};

const container = document.getElementById('options');
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}
