/**
 * Dynamic, quirky, and supportive greetings for the Executive Assistant persona.
 * Used for empty states and "All Done" messages.
 */

export const EMPTY_STATE_MESSAGES = [
  "No missions today. Your cape is in the wash! 🧺",
  "Zero jobs found. Time for a tactical nap? 😴",
  "It's quiet... too quiet. Go get a latte. ☕",
  "Schedule clear! The baseboards are safe... for now. 🛡️",
  "All missions accomplished. You're crushing it! 🚀",
  "No jobs scheduled. The world is your oyster today. 🌍",
  "Zero tasks pending. Executive privilege: granted! 🥂",
  "You've cleared the board. Ready for some self-care? 💅",
  "The schedule is empty, but your potential is infinite. ✨",
  "Mission Control reports: All systems go, zero friction! 🛸"
];

export function getRandomEmptyMessage() {
  const index = Math.floor(Math.random() * EMPTY_STATE_MESSAGES.length);
  return EMPTY_STATE_MESSAGES[index];
}
