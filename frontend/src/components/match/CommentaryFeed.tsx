import React, { useRef, useEffect } from 'react';
import type { SimulationTick } from '../../types';

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticks.length]);

  return (
    <div className={`bg-gray-800/80 rounded-xl border border-gray-700/40 p-4 ${className}`}>
      <h3 className="text-overline text-gray-400 uppercase tracking-wider mb-3">
        Commentary
      </h3>
      <div
        ref={scrollRef}
        className="max-h-48 overflow-y-auto space-y-1.5 pr-1 dark-scrollbar"
      >
        {ticks.length === 0 && (
          <p className="text-gray-500 text-body-sm text-center py-4">
            Waiting for match to begin...
          </p>
        )}

        {ticks.map((tick, idx) => {
          const isLatest = idx === ticks.length - 1;
          const hasGoal = tick.events.some((e) => e.type === 'goal');
          const hasCard = tick.events.some(
            (e) => e.type === 'yellow_card' || e.type === 'red_card',
          );

          let lineClass = 'text-gray-500 text-body-sm';
          if (isLatest) {
            lineClass = 'text-white text-body-sm font-semibold';
          } else if (hasGoal) {
            lineClass = 'text-green-400 text-body-sm font-medium';
          } else if (hasCard) {
            lineClass = 'text-yellow-400 text-body-sm';
          }

          return (
            <div key={`${tick.minute}-${idx}`} className={`${lineClass} leading-relaxed`}>
              <span className="text-gray-400 font-mono text-caption mr-2 inline-block w-10 text-right">
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
