import type { Story } from '@ladle/react';
import { useState } from 'react';
import { UINumericInput } from '../src/components/numeric-input';

export default {
  title: 'Components/NumericInput',
};

export const Playground: Story = () => {
  const [segments, setSegments] = useState(2);
  const [height, setHeight] = useState(260);

  return (
    <div className="flex flex-col gap-4 bg-active-bg p-6 text-active-text">
      <div className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-active-text/60">
          Segments
        </div>
        <UINumericInput min={1} max={4} step={1} value={segments} onValueChange={setSegments} />
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-active-text/60">
          Height (cm)
        </div>
        <UINumericInput
          value={height}
          onValueChange={setHeight}
          min={200}
          max={400}
          step={5}
          density="compact"
        />
      </div>
      <div className="text-xs text-active-text/80">
        Segments: {segments} • Height: {height} cm
      </div>
    </div>
  );
};
