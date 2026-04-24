export const SERVICES = [
  { key: 'deep_clean', label: 'Deep Clean',       rate: 185, defaultDuration: 150, emoji: '🧼' },
  { key: 'regular',    label: 'Regular',          rate: 120, defaultDuration: 105, emoji: '✨' },
  { key: 'quick_tidy', label: 'Quick Tidy',       rate: 85,  defaultDuration: 60,  emoji: '🌀' },
  { key: 'organizing', label: 'Organize',         rate: 160, defaultDuration: 180, emoji: '📦' },
  { key: 'declutter',  label: 'Declutter + Org.', rate: 240, defaultDuration: 240, emoji: '🗂' },
  { key: 'move_out',   label: 'Move Out',         rate: 320, defaultDuration: 300, emoji: '📤' },
  { key: 'custom',     label: 'Custom',           rate: 0,   defaultDuration: 120, emoji: '✎' },
];

export const RECURRENCE = [
  { key: null,       label: 'None' },
  { key: 'weekly',   label: 'Weekly' },
  { key: 'biweekly', label: 'Biweekly' },
  { key: 'monthly',  label: 'Monthly' },
];
