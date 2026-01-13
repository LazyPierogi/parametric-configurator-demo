import type { Story } from '@ladle/react';
import { UIChip } from '../src/components/chip';

export default {
  title: 'Components/Chip',
};

export const Default: Story = () => (
  <div className="flex flex-wrap gap-3 p-4 bg-active-bg">
    <UIChip>Neutral</UIChip>
    <UIChip selected>Selected</UIChip>
    <UIChip disabled>Disabled</UIChip>
  </div>
);

export const Swatches: Story = () => (
  <div className="flex flex-wrap gap-4 p-4 bg-active-bg">
    {['Sage', 'Lilac', 'Sand', 'Charcoal'].map(name => (
      <UIChip key={name} variant="swatch" aria-label={name}>
        <span className="inline-block h-8 w-8 rounded-full bg-active-accent" />
      </UIChip>
    ))}
  </div>
);
