import type { Story } from '@ladle/react';
import { UISummaryCard, UISummaryRow } from '../src/components/summary-card';

export default {
  title: 'Components/SummaryCard',
};

export const Playground: Story = () => (
  <div className="bg-active-bg p-6">
    <UISummaryCard
      title="Summary"
      providerLabel="Mock Provider"
      thumbnail={
        <div className="flex justify-center">
          <div className="h-24 w-24 rounded-xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-100 shadow-inner" />
        </div>
      }
    >
      <div className="flex flex-col gap-1.5">
        <UISummaryRow label="Fabric" value="Marbella Wave" />
        <UISummaryRow label="Color" value="Ivory" />
        <UISummaryRow label="Pleat" value="Wave" />
        <UISummaryRow label="Total" value="5 230 PLN" tone="accent" />
      </div>
    </UISummaryCard>
  </div>
);
