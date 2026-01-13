import type { Story } from '@ladle/react';
import { useState } from 'react';
import { UIDialog } from '../src/components/dialog';
import { UIButton } from '../src/components/button';

export default {
  title: 'Components/Dialog',
};

export const Playground: Story = () => {
  const [open, setOpen] = useState(true);

  return (
    <div className="p-4 bg-active-bg min-h-[50vh]">
      <UIButton onClick={() => setOpen(true)}>Open Dialog</UIButton>
      <UIDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Save fabric selection"
        footer={
          <div className="flex justify-end gap-2">
            <UIButton variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </UIButton>
            <UIButton onClick={() => setOpen(false)}>Save</UIButton>
          </div>
        }
      >
        <p className="text-active-text/80">
          Make sure your selection works across both mobile and desktop views before publishing.
        </p>
      </UIDialog>
    </div>
  );
};
