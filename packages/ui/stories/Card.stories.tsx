import type { Story } from '@ladle/react';
import { UICard } from '../src/components/card';

export default {
  title: 'Components/Card',
};

export const Variants: Story = () => (
  <div className="grid gap-4 p-4 bg-active-bg md:grid-cols-3">
    <UICard variant="default">
      <h3 className="text-lg font-semibold text-active-text">Default</h3>
      <p className="text-sm text-active-text/70">Use for informational sections.</p>
    </UICard>
    <UICard variant="selectable" hoverable>
      <h3 className="text-lg font-semibold text-active-text">Selectable</h3>
      <p className="text-sm text-active-text/70">Tap to choose fabrics/options.</p>
    </UICard>
    <UICard variant="elevated" hoverable>
      <h3 className="text-lg font-semibold text-active-text">Elevated</h3>
      <p className="text-sm text-active-text/70">Use for modals or highlights.</p>
    </UICard>
  </div>
);
