interface TimelineEntry {
  minute: number;
  type: string;
  team: string;
  player: string | null;
  description: string;
}

interface EventTimelineProps {
  events: TimelineEntry[];
  compact?: boolean;
}

export default function EventTimeline({ events, compact = false }: EventTimelineProps) {
  const keyEvents = events.filter((e) =>
    ['goal', 'yellow_card', 'red_card', 'second_yellow', 'substitution'].includes(e.type)
  );

  if (keyEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-navy-500 text-xs">
        No key events yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {keyEvents.slice(compact ? -6 : undefined).map((e, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-navy-400 w-6 text-right tabular-nums">{e.minute}'</span>
          <EventIcon type={e.type} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-white truncate">
              {e.player || e.description}
            </p>
          </div>
          <span className={`text-[9px] font-bold uppercase ${
            e.team === 'home' ? 'text-brand-400' : 'text-blue-400'
          }`}>
            {e.team === 'home' ? 'H' : 'A'}
          </span>
        </div>
      ))}
    </div>
  );
}

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case 'goal':
      return <span className="text-xs">&#9917;</span>;
    case 'yellow_card':
      return <span className="w-2.5 h-3 bg-yellow-400 rounded-[1px] inline-block" />;
    case 'red_card':
      return <span className="w-2.5 h-3 bg-red-500 rounded-[1px] inline-block" />;
    case 'second_yellow':
      return (
        <span className="relative w-3 h-3 inline-block">
          <span className="absolute left-0 top-0 w-2.5 h-3 bg-yellow-400 rounded-[1px]" />
          <span className="absolute left-1 top-0 w-2.5 h-3 bg-red-500 rounded-[1px]" />
        </span>
      );
    case 'substitution':
      return <span className="text-xs text-brand-400">&harr;</span>;
    default:
      return <span className="w-2 h-2 bg-navy-600 rounded-full inline-block" />;
  }
}

export type { TimelineEntry };
