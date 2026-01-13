import type { Story } from '@ladle/react';
import { UIButton } from '../src/components/button';

export default {
  title: 'Components/Button',
};

export const Variants: Story = () => (
  <div className="flex flex-wrap gap-4 p-4 bg-active-bg">
    <UIButton variant="primary">Primary</UIButton>
    <UIButton variant="secondary">Secondary</UIButton>
    <UIButton variant="ghost">Ghost</UIButton>
    <UIButton variant="danger">Danger</UIButton>
  </div>
);

export const Sizes: Story = () => (
  <div className="flex flex-col gap-4 p-4 bg-active-bg">
    <UIButton size="sm">Small</UIButton>
    <UIButton size="md">Medium</UIButton>
    <UIButton size="lg">Large</UIButton>
  </div>
);
