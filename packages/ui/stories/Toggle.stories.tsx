import type { Story } from '@ladle/react';
import { useState } from 'react';
import { UIToggle } from '../src/components/toggle';

export default {
  title: 'Components/Toggle',
};

export const Playground: Story = () => {
  const [comfort, setComfort] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  return (
    <div className="flex flex-col gap-4 bg-active-bg p-6 text-active-text">
      <UIToggle checked={comfort} onCheckedChange={setComfort}>
        Enable Comfort Lining
      </UIToggle>
      <UIToggle
        checked={reducedMotion}
        onCheckedChange={setReducedMotion}
        size="sm"
        label="Reduced motion"
      />
      <UIToggle checked disabled label="Disabled" />
    </div>
  );
};
