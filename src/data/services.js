// Service catalog — kept in JS until we have a /services management UI.
// Maps to the existing `services` table by `name`. Rates here may diverge from
// services.default_price in Supabase if changed in the DB outside this file.
export const SERVICES = [
  { key: 'declutter',  label: 'Declutter',        rate: 160, defaultDuration: 180, emoji: '🗂' },
  { key: 'organize',   label: 'Organize',         rate: 160, defaultDuration: 180, emoji: '📦' },
  { key: 'assist',     label: 'Assist',           rate: 120, defaultDuration: 120, emoji: '🤝' },
  { key: 'move_prep',  label: 'Move Prep',        rate: 200, defaultDuration: 240, emoji: '📦' },
  { key: 'systems',    label: 'Home Systems',     rate: 160, defaultDuration: 180, emoji: '⚙' },
  { key: 'custom',     label: 'Custom',           rate: 0,   defaultDuration: 120, emoji: '✎' },
];

// Recurrence keys map to ai_context.recurrence_rule on jobs.
// Future: migrate to job_templates table when the recurrence UI is built.
export const RECURRENCE = [
  { key: null,       label: 'None' },
  { key: 'Weekly',   label: 'Weekly' },
  { key: 'Biweekly', label: 'Biweekly' },
  { key: 'Monthly',  label: 'Monthly' },
];
