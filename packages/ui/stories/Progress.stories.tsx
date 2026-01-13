import type { Story } from '@ladle/react';
import { useState, useEffect } from 'react';
import { UIProgress } from '../src/components/progress';

export default {
  title: 'Components/Progress',
};

export const Playground: Story = () => {
  const [value, setValue] = useState(40);

  useEffect(() => {
    const interval = setInterval(() => {
      setValue((prev) => (prev >= 100 ? 0 : prev + 10));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-4 bg-active-bg p-6 text-active-text">
      <UIProgress value={value} showLabel />
      <UIProgress value={70} size="lg" tone="success" />
      <UIProgress value={50} size="sm" tone="warning" />
      <UIProgress value={30} tone="error" />
    </div>
  );
};
