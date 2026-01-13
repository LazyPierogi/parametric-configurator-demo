import type { Story } from '@ladle/react';
import { UISpinner } from '../src/components/spinner';

export default {
  title: 'Components/Spinner',
};

export const Playground: Story = () => (
  <div className="flex flex-wrap items-center gap-6 bg-active-bg p-6 text-active-text">
    <div className="flex flex-col items-center gap-2">
      <UISpinner size="sm" color="neutral" />
      <span className="text-xs text-active-text/70">Small</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <UISpinner size="md" color="accent" />
      <span className="text-xs text-active-text/70">Medium</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <UISpinner size="lg" color="light" className="bg-active-text/10 p-4 rounded-full" />
      <span className="text-xs text-active-text/70">Large</span>
    </div>
  </div>
);
