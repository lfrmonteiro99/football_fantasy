import React, { useRef, useEffect } from 'react';
import type { SimulationTickEvent, MatchEventType } from '../../types';

// ---------------------------------------------------------------------------
// EventTimeline — Vertical scrollable list of key match events
// ---------------------------------------------------------------------------
// Filters to only show KEY events: goal, yellow_card, red_card, substitution,
// penalty, penalty_miss, save. Minor events (pass, throw_in, etc.) are skipped.
// Home events align LEFT, away events align RIGHT.
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  minute: number;
  type: MatchEventType;
  team: 'home' | 'away';
  playerName: string | null;
  description: string;
}

export interface EventTimelineProps {
  events: TimelineEntry[];
  className?: string;
}

const KEY_EVENT_TYPES: Set<string> = new Set([
  'goal',
  'yellow_card',
  'red_card',
  'substitution',
  'penalty',
  'penalty_miss',
  'save',
]);

/** Map event type to an icon string */
function eventIcon(type: MatchEventType): string {
  switch (type) {
    case 'goal':
      return '\u26BD'; // soccer ball
    case 'yellow_card':
      return '\uD83D\uDFE8'; // yellow square
    case 'red_card':
      return '\uD83D\uDFE5'; // red square
    case 'substitution':
      return '\uD83D\uDD04'; // arrows cycle
    case 'penalty':
      return '\u26BD'; // same as goal
    case 'penalty_miss':
      return '\u274C'; // cross
    case 'save':
      return '\uD83E\uDDE4'; // gloves
    default:
      return '\u25CF'; // dot
  }
}

/** Map event type to a minute badge color */
function minuteBadgeColor(type: MatchEventType): string {
  switch (type) {
    case 'goal':
    case 'penalty':
      return 'bg-green-600';
    case 'yellow_card':
      return 'bg-yellow-500';
    case 'red_card':
      return 'bg-red-600';
    case 'substitution':
      return 'bg-blue-500';
    case 'save':
      return 'bg-purple-500';
    case 'penalty_miss':
      return 'bg-orange-500';
    default:
      return 'bg-gray-600';
  }
}

/**
 * Convert SimulationTickEvents to timeline entries.
 * Utility exported for pages to use.
 */
export function tickEventsToTimeline(
  tickEvents: { minute: number; events: SimulationTickEvent[] }[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const tick of tickEvents) {
    for (const ev of tick.events) {
      if (KEY_EVENT_TYPES.has(ev.type)) {
        entries.push({
          minute: tick.minute,
          type: ev.type,
          team: ev.team,
          playerName: ev.primary_player_name,
          description: ev.description,
        });
      }
    }
  }
  return entries;
}

/**
 * Convert MatchEvent[] (from completed match) to timeline entries.
 */
export function matchEventsToTimeline(
  events: { minute: number; event_type: MatchEventType; team_type: 'home' | 'away'; player_name: string; description: string }[],
): TimelineEntry[] {
  return events
    .filter((e) => KEY_EVENT_TYPES.has(e.event_type))
    .map((e) => ({
      minute: e.minute,
      type: e.event_type,
      team: e.team_type,
      playerName: e.player_name,
      description: e.description,
    }));
}

const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest event
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Key Events
        </h3>
        <p className="text-gray-500 text-sm text-center py-4">
          No key events yet
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Key Events
      </h3>
      <div
        ref={scrollRef}
        className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-gray-600"
      >
        {events.map((ev, idx) => {
          const isHome = ev.team === 'home';
          return (
            <div
              key={`${ev.minute}-${ev.type}-${idx}`}
              className={`flex items-start gap-2 ${
                isHome ? 'flex-row' : 'flex-row-reverse'
              }`}
            >
              {/* Minute badge */}
              <div
                className={`flex-shrink-0 w-9 h-9 rounded-full ${minuteBadgeColor(
                  ev.type,
                )} flex items-center justify-center`}
              >
                <span className="text-xs font-bold text-white">
                  {ev.minute}'
                </span>
              </div>

              {/* Event content */}
              <div
                className={`flex-1 min-w-0 ${
                  isHome ? 'text-left' : 'text-right'
                }`}
              >
                <div className="flex items-center gap-1.5"
                  style={{ justifyContent: isHome ? 'flex-start' : 'flex-end' }}
                >
                  <span className="text-base">{eventIcon(ev.type)}</span>
                  <span className="text-sm font-semibold text-white truncate">
                    {ev.playerName || 'Unknown'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                  {ev.description}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default EventTimeline;
