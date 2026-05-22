import React from 'react';
// icons.jsx — Lucide-style line icons for WaFli
const Icon = ({ d, size = 20, stroke = 'currentColor', sw = 1.75, fill = 'none', children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {d ? <path d={d} /> : children}
  </svg>
);

const Icons = {
  Chats: (p) => <Icon {...p}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z" /></Icon>,
  Plan: (p) => <Icon {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></Icon>,
  Settings: (p) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Icon>,
  Search: (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>,
  More: (p) => <Icon {...p}><circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" /></Icon>,
  Back: (p) => <Icon {...p}><path d="m15 18-6-6 6-6" /></Icon>,
  Close: (p) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>,
  Send: (p) => <Icon {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></Icon>,
  Attach: (p) => <Icon {...p}><path d="m21.44 11.05-8.49 8.49a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 1 1 4.95 4.95l-8.5 8.49a2 2 0 1 1-2.82-2.82l8.14-8.14" /></Icon>,
  Mic: (p) => <Icon {...p}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></Icon>,
  Sparkles: (p) => <Icon {...p}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2" sw={1.5} /><path d="M12 8a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4Z" sw={1.5} /></Icon>,
  Refresh: (p) => <Icon {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></Icon>,
  Edit: (p) => <Icon {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></Icon>,
  Bolt: (p) => <Icon {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></Icon>,
  Hourglass: (p) => <Icon {...p}><path d="M6 2h12M6 22h12M6 2v4a6 6 0 0 0 12 0V2M6 22v-4a6 6 0 0 1 12 0v4" /></Icon>,
  Copy: (p) => <Icon {...p}><rect x="9" y="9" width="13" height="13" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Icon>,
  Check: (p) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>,
  Chevron: (p) => <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>,
  User: (p) => <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>,
  Card: (p) => <Icon {...p}><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /></Icon>,
  Lock: (p) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Icon>,
  Bell: (p) => <Icon {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21a2 2 0 0 0 4 0" /></Icon>,
  Globe: (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Icon>,
  Help: (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-1 .5-1 1.2-1 1.7" /><circle cx="12" cy="17" r="0.5" fill="currentColor" /></Icon>,
  Doc: (p) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></Icon>,
  Logout: (p) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Icon>,
  Plus: (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>,
  Empty: (p) => <Icon {...p}><path d="M21 15a8 8 0 1 0-15.7 2L4 21l4-1a8 8 0 0 0 13-5Z" sw={1.25} /><path d="M9 12h.01M12 12h.01M15 12h.01" sw={1.5} /></Icon>,
  EmptyBattery: (p) => <Icon {...p}><rect x="2" y="7" width="18" height="10" rx="2.5" sw={1.5} /><path d="M22 11v2" sw={1.5} /></Icon>,
  Phone: (p) => <Icon {...p}><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></Icon>,
  Cellular: (p) => <Icon {...p}><path d="M2 12h2v3H2zM6 9h2v6H6zM10 6h2v9h-2zM14 3h2v12h-2z" fill="currentColor" stroke="none" /></Icon>,
  Wifi: (p) => <Icon {...p}><path d="M2 8a14 14 0 0 1 20 0M5 11.5a9 9 0 0 1 14 0M8.5 15a4 4 0 0 1 7 0M12 19h.01" /></Icon>,
  Battery: (p) => <Icon {...p}><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" /><rect x="4" y="9" width="14" height="6" rx="0.5" fill="currentColor" stroke="none" /></Icon>,
  Logo: ({ size = 20, color: _color = 'currentColor' }) => (
    <img
      src="/icons/wafli-icon-192.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ display: 'block', borderRadius: '22%' }}
    />
  ),
};

window.Icons = Icons;
window.Icon = Icon;
