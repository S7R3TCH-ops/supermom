import { fmtTime12 } from './dateUtils';
import { getPersistentDailyMessage } from './greetings';

const NICKNAMES = ['Boss', 'Hero', 'Champ', 'Legend', 'Captain'];

function dailyAddress(now, firstName) {
  const daySeed = now.toDateString() + firstName;
  let h = 0;
  for (let i = 0; i < daySeed.length; i++) { h = ((h << 5) - h) + daySeed.charCodeAt(i); h |= 0; }
  return (Math.abs(h) % 10) < 4 ? NICKNAMES[Math.abs(h >> 2) % NICKNAMES.length] : firstName;
}

export function getBriefingMessage({ allDone, activeJob, next, now, todayJobs, attentionItemCount, persona, firstName }) {
  const hour = now.getHours();
  const isMorning = hour < 12;
  const isEvening = hour >= 17;
  const address = dailyAddress(now, firstName);

  if (allDone) {
    if (isMorning) return `Done already, ${address}? You're a morning superhero.`;
    if (isEvening) return `Wrapped for the day. Go put your feet up, ${address}.`;
    return "All wrapped up. Go enjoy the rest of your afternoon!";
  }

  if (activeJob) {
    const remainingCount = todayJobs.filter(j => j.status === 'Scheduled' && j.id !== activeJob.id).length;
    const moreStr = remainingCount > 0 ? `${remainingCount} more` : 'one more';
    if (isMorning) return `In the zone! ${moreStr} boss ${remainingCount === 1 ? 'move' : 'moves'} before noon.`;
    if (isEvening) return `Almost there — ${moreStr} and you're done for tonight.`;
    return `Locked in. ${moreStr} to go this afternoon.`;
  }

  if (next) {
    const minsToStart = Math.round((next.start - now) / 60000);
    const jobsRemaining = todayJobs.filter(j => j.status === 'Scheduled' && j.payment_status !== 'Paid').length;
    const countStr = jobsRemaining > 1 ? ` · ${jobsRemaining - 1} more after` : '';

    if (minsToStart <= 0) {
      if (isMorning) return `Suit up, ${address}! Your next mission is starting now.${countStr}`;
      if (isEvening) return `Last push, ${address}! Starting right now.${countStr}`;
      return `Time to go! Next mission is starting now.${countStr}`;
    }

    if (minsToStart < 60) {
      if (isMorning) return `T-minus ${minsToStart} mins. Morning's moving fast.${countStr}`;
      if (isEvening) return `T-minus ${minsToStart} mins — one more and you're free, ${address}.${countStr}`;
      return `T-minus ${minsToStart} mins until you save the day again.${countStr}`;
    }

    const timeStr = fmtTime12(next.start);
    const timeLabel = `${timeStr.time} ${timeStr.period}`;
    if (isMorning) return `Deep breaths. Next mission at ${timeLabel}.${countStr}`;
    if (isEvening) return `One more at ${timeLabel}. Enjoy the downtime.${countStr}`;
    return `Enjoy the gap. Back at it by ${timeLabel}.${countStr}`;
  }

  if (attentionItemCount > 0) {
    return `${attentionItemCount} job${attentionItemCount > 1 ? 's' : ''} need wrapping up. Let's tidy those out.`;
  }

  try {
    return getPersistentDailyMessage('briefing', persona).replace(/{name}/g, address);
  } catch {
    return "Ready for the day.";
  }
}
