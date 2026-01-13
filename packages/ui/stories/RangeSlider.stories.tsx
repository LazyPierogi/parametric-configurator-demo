import type { Story } from '@ladle/react';
import { useState } from 'react';
import { UIRangeSlider } from '../src/components/range-slider';

export default {
  title: 'Components/RangeSlider',
};

export const Playground: Story = () => {
  const [range, setRange] = useState<[number, number]>([120, 220]);

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-active-bg p-6 text-active-text shadow-low">
      <div className="space-y-1">
        <div className="text-sm font-semibold uppercase tracking-wide text-active-text/70">
          Budget per meter
        </div>
        <div className="text-xs text-active-text/60">Drag handles or use arrow keys to adjust.</div>
      </div>
      <UIRangeSlider min={0} max={400} step={5} value={range} onChange={setRange} />
      <div className="text-sm font-medium">
        Selected: {range[0]} – {range[1]} PLN
      </div>
    </div>
  );
};
