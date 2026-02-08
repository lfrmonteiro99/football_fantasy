import React, { useRef, useEffect } from 'react';
import type { SimulationTick } from '../../types';

// ---------------------------------------------------------------------------
// CommentaryFeed — Minute-by-minute text commentary
// ---------------------------------------------------------------------------
// Each entry: [minute'] commentary text.
// Auto-scrolls to bottom. Gray text, latest entry in white/bold.
// ---------------------------------------------------------------------------

export interface CommentaryFeedProps {
  ticks: SimulationTick[];
  className?: string;
}

const CommentaryFeed: React.FC<CommentaryFeedProps> = ({
  ticks,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest commentary
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticks.length]);

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Commentary
      </h3>
      <div
        ref={scrollRef}
        className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-gray-600"
      >
        {ticks.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">
            Waiting for match to begin...
          </p>
        )}

        {ticks.map((tick, idx) => {
          const isLatest = idx === ticks.length - 1;
          // Determine if this tick has a notable event
          const hasGoal = tick.events.some((e) => e.type === 'goal');
          const hasCard = tick.events.some(
            (e) => e.type === 'yellow_card' || e.type === 'red_card',
          );

          let lineClass = 'text-gray-500 text-sm';
          if (isLatest) {
            lineClass = 'text-white text-sm font-semibold';
          } else if (hasGoal) {
            lineClass = 'text-green-400 text-sm font-medium';
          } else if (hasCard) {
            lineClass = 'text-yellow-400 text-sm';
          }

          return (
            <div key={`${tick.minute}-${idx}`} className={`${lineClass} leading-relaxed`}>
              <span className="text-gray-400 font-mono mr-2 inline-block w-10 text-right">
                [{tick.minute}']
              </span>
              <span>{tick.commentary}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default CommentaryFeed;
