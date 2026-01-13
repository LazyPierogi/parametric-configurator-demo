# Curtain Wizard — Tasks 805 & 806 User Stories

## Task 805 — Client Caching & Request Deduplication

### User Stories
- As a returning user, I want the wizard to remember the last successful segmentation so that I can revisit the preview without re-uploading the same photo.
- As a user experimenting with small tweaks, I want the app to reuse an in-flight request when I accidentally double-submit the same image so that I do not waste time waiting twice.
- As an offline-prone mobile user, I want cached masks to persist locally so that I can resume where I left off even after a connection hiccup.

### Acceptance Tests
- Given a previously segmented image, when I reopen the configurator, then the app loads the cached mask and metadata without calling `/api/segment` again.
- Given that I trigger two segmentation requests with identical payloads within five seconds, when the first succeeds, then only one network request is sent and both UI triggers resolve with the same response.
- Given that local cached data exceeds a 25 MB limit, when a new mask is stored, then the oldest cached entry is evicted and the eviction is logged to the console (dev mode) without breaking the latest result.
- Given a network failure after a successful segmentation, when I refresh the page, then the last mask is restored from cache and a banner indicates it is an offline copy.

## Task 806 — Validation & Rich Upload UX

### User Stories
- As a user uploading a photo, I want the wizard to reject oversized images with a clear message so that I understand how to fix the issue.
- As a desktop user, I want to drag and drop images directly into the wizard so that I can work faster than using the file picker.
- As a power user, I want to paste screenshots from the clipboard so that I can quickly test the flow without saving files.
- As a user on a slow connection, I want to see upload and processing progress so that I know the app is responsive.

### Acceptance Tests
- Given an image larger than the configured limit (default 15 MB), when I attempt to upload it, then the app blocks the upload, shows an error toast with guidance, and does not call `/api/measure` or `/api/segment`.
- Given a valid image, when I drag and drop it onto the upload target, then the file is accepted, the wizard starts processing, and the same validation as the file picker applies.
- Given a valid image in the clipboard, when I focus the wizard and press paste, then the image is accepted, previewed, and processed as if uploaded via the picker.
- Given any upload path (picker, drag-drop, paste), when the file is being uploaded, then a progress indicator reflects transfer status; when the backend processing begins, the indicator switches to "processing" until results return.
