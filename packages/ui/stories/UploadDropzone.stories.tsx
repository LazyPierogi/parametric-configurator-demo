import type { Story } from '@ladle/react';
import { useState } from 'react';
import { UIUploadDropzone } from '../src/components/upload-dropzone';

export default {
  title: 'Components/UploadDropzone',
};

export const Playground: Story = () => {
  const [hasImage, setHasImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="space-y-4 bg-active-bg p-6 text-active-text">
      <UIUploadDropzone
        title="Drop or paste a room photo"
        description="JPEG, PNG, HEIC up to 40 MB"
        note="Drag a file anywhere or click below to select"
        isEmpty={!hasImage}
        dragActive={dragActive}
        className="min-h-[240px]"
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
      >
        <div className="flex h-[220px] items-center justify-center rounded-2xl bg-black/10 text-sm">
          Preview Area
        </div>
      </UIUploadDropzone>
      <button
        type="button"
        className="rounded-full border border-active-border px-4 py-2 text-sm"
        onClick={() => setHasImage((prev) => !prev)}
      >
        Toggle image ({hasImage ? 'shown' : 'empty'})
      </button>
    </div>
  );
};
