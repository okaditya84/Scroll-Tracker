import React from 'react';
import { createRoot } from 'react-dom/client';

const Options = () => (
  <main style={{ padding: 24, fontFamily: 'Inter, sans-serif', color: '#0f172a' }}>
    <h1 style={{ fontSize: 24, marginBottom: 12 }}>Scrollwise Settings</h1>
    <p style={{ maxWidth: 420, lineHeight: 1.6 }}>
      Use the web dashboard to configure tracking goals, download your data, or delete your account.
      This page will host advanced extension preferences in a future release.
    </p>
  </main>
);

const container = document.getElementById('options');
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}
