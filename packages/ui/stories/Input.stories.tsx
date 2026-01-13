import type { Story } from '@ladle/react';
import { UIInput } from '../src/components/input';

export default {
  title: 'Components/Input',
};

export const States: Story = () => (
  <div className="flex flex-col gap-4 p-4 bg-active-bg">
    <UIInput placeholder="Default input" />
    <UIInput placeholder="Error state" error />
    <UIInput placeholder="Compact density" density="compact" />
    <UIInput placeholder="Disabled" disabled />
  </div>
);
