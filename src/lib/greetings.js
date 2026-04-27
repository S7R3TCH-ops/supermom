/**
 * Dynamic, persona-aware, and persistent greetings for the Executive Assistant.
 * Messages stay stable for the entire day (midnight to midnight).
 */

const STORAGE_KEY = 'sm_daily_messages';

const CONTENT = {
  professional: {
    briefing: [
      "Systems check complete. All client objectives are synchronized.",
      "Today's logistics are optimized. Ready for deployment.",
      "The spreadsheet of your life is balanced. Let's execute.",
      "Strategic overview: Zero friction detected in the upcoming operations.",
      "Objective-based planning engaged. Awaiting your first deployment."
    ],
    schedule: [
      "The schedule is currently clear. Excellent for administrative catch-up.",
      "Zero missions pending. Tactical regrouping advised.",
      "Efficiency metrics indicate a clear window for professional development.",
      "No client engagements found. The deck is clear for your next move.",
      "Schedule empty. Proceeding with standby protocol."
    ],
    greeting: [
      "Good morning, Supermom. Operational readiness is at 100%.",
      "Good afternoon. Efficiency remains high across all sectors.",
      "Good evening. Mission review complete. Systems powering down."
    ]
  },
  coach: {
    briefing: [
      "Georgetown isn't ready for your level of awesome today! Let's shine.",
      "Breathe in the confidence, breathe out the chaos. You're a rockstar!",
      "You're not just organizing spaces, you're building a legacy! Go get 'em.",
      "Every system you create is a step toward their peace. Your energy is magnetic today!",
      "Look at that smile! Today is going to be your most impactful one yet."
    ],
    schedule: [
      "The world is your oyster today! What incredible thing will you do next?",
      "Zero tasks pending. Executive privilege granted for self-care!",
      "You've cleared the board. Ready for some well-deserved 'me time'?",
      "All missions accomplished. You're absolutely crushing this life!",
      "The schedule is clear because you're a manifestation master. Enjoy it!"
    ],
    greeting: [
      "Rise and shine, superstar! The world needs your magic today.",
      "You're halfway there and looking amazing! Keep that momentum going.",
      "Winding down... You've earned a glass of wine (and a very long bath)."
    ]
  },
  casual: {
    briefing: [
      "Sup! Let's do the thing. Coffee first, then world domination.",
      "Alright, let's get this bread. Or at least get this organizing done.",
      "Nice outfit. Ready to make some spaces look actually logical?",
      "The junk drawers are gossiping about you. Go show them who's boss.",
      "I checked the weather: 100% chance of you being a complete badass."
    ],
    schedule: [
      "No missions today. Your cape is in the wash (or the floor, whatever).",
      "Zero jobs found. Time for a tactical nap? I won't tell.",
      "It's quiet... too quiet. Go get a latte and enjoy the silence.",
      "Schedule clear! The world is basically your playground today.",
      "All done! High five yourself, then go do something fun."
    ],
    greeting: [
      "Hey there! Ready to head out and do some great work today?",
      "Halfway through! You're doing the thing. Keep it up.",
      "Mission accomplished. Go put your feet up, you legend."
    ]
  }
};

const CLOSERS = [
  "Go get 'em!",
  "Coffee first, then world domination.",
  "Your VIPs are waiting!",
  "Ready to make some magic?",
  "Let's show them how it's done.",
  "Time to shine!",
  "Deployment authorized. Go!",
  "Georgetown's favorite hero is on the move."
];

/**
 * Returns a persistent message for the current day based on the date string.
 * This ensures the message is stable for the day without needing localStorage.
 */
function getDeterministicRandom(seed, max) {
  let hash = 0;
  for (let i = 0; i < (seed || '').length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0; 
  }
  return Math.abs(hash) % max;
}

export function getPersistentDailyMessage(type, persona = 'professional') {
  const today = new Date().toDateString();
  const p = (CONTENT[persona]) ? persona : 'professional';
  const pContent = CONTENT[p] || CONTENT.professional;
  
  // Use unique seeds for different message types
  const seed = `${today}-${p}-${type}`;
  
  if (type === 'briefing') {
    return pContent.briefing[getDeterministicRandom(seed, pContent.briefing.length)];
  }
  if (type === 'schedule') {
    return pContent.schedule[getDeterministicRandom(seed, pContent.schedule.length)];
  }
  if (type === 'greeting_morning') return pContent.greeting[0];
  if (type === 'greeting_afternoon') return pContent.greeting[1];
  if (type === 'greeting_evening') return pContent.greeting[2];

  return pContent.briefing[0];
}

export function getTimeBasedGreeting(name, persona = 'professional', hasJobsLeft = true) {
  const hour = new Date().getHours();
  let type = 'greeting_morning';
  if (hour >= 12 && hour < 17) type = 'greeting_afternoon';
  else if (hour >= 17) type = 'greeting_evening';
  
  const msg = getPersistentDailyMessage(type, persona);
  const first = name?.split(' ')[0] || 'there';
  
  if (!hasJobsLeft) return msg;

  const today = new Date().toDateString();
  const seed = `${today}-${first}-closer`;
  const closer = CLOSERS[getDeterministicRandom(seed, CLOSERS.length)];
  
  return `${msg} ${closer}`;
}

// Keep these for backward compatibility if needed by other components
export function getRandomBriefingMessage(persona) { return getPersistentDailyMessage('briefing', persona); }
export function getRandomScheduleMessage(persona) { return getPersistentDailyMessage('schedule', persona); }
