import { EmptyActivity } from '../ui/Illustrations';

const MESSAGES = {
  casual: { allDone: "Nice work, you're all set!", notDone: "Nothing on the list today. Chill time?" },
  professional: { allDone: "Mission Accomplished!", notDone: "Schedule clear." },
  coach: { allDone: "Solid hustle today!", notDone: "The board is clean. Time to recharge!" },
};

export default function EmptyState({ allDone, T, persona }) {
  const msgSet = MESSAGES[persona?.toLowerCase()] || MESSAGES.professional;
  const msg = allDone ? msgSet.allDone : msgSet.notDone;
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', opacity: 0.9 }}>
      <EmptyActivity size={100} />
      <div style={{ marginTop: 16, fontFamily: T.font, fontSize: 13, color: T.inkMuted }}>{msg}</div>
    </div>
  );
}
