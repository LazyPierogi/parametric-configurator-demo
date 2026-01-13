import type { Story } from '@ladle/react';
import { useState } from 'react';
import { UISelect } from '../src/components/select';

export default {
  title: 'Components/Select',
};

export const Playground: Story = () => {
  const [value, setValue] = useState('option1');
  return (
    <div className="flex flex-col gap-4 bg-active-bg p-6 text-active-text">
      <UISelect value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="option1">Sheer</option>
        <option value="option2">Light filtering</option>
        <option value="option3">Blackout</option>
      </UISelect>
      <UISelect density="compact" defaultValue="signature">
        <option value="signature">Signature palette</option>
        <option value="havinic">Havinic palette</option>
      </UISelect>
      <UISelect error defaultValue="error">
        <option value="error">Invalid selection</option>
      </UISelect>
      <div className="text-sm text-active-text/70">Selected value: {value}</div>
    </div>
  );
};
