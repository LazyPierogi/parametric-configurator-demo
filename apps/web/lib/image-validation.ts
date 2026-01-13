/**
 * Image file validation and conversion utilities
 * 
 * Handles:
 * - File type validation (allow only safe image formats)
 * - HEIC to JPEG conversion for iPhone photos
 * - File size validation
 */

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

// Allowed file extensions (fallback if MIME type is missing)
const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
] as const;

export type ImageValidationError =
  | 'invalid_type'
  | 'file_too_large'
  | 'conversion_failed'
  | 'unknown_error';

export interface ImageValidationResult {
  valid: boolean;
  file?: File;
  error?: ImageValidationError;
  message?: string;
}

/**
 * Check if a file is a valid image type
 */
export function isValidImageType(file: File): boolean {
  // Check MIME type
  if (file.type && ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return true;
  }

  // Fallback: check extension
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (ext && ALLOWED_EXTENSIONS.includes(ext as any)) {
    return true;
  }

  return false;
}

/**
 * Check if a file is HEIC/HEIF format
 */
export function isHEIC(file: File): boolean {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  );
}

// HEIC optimization settings from env (with fallback defaults)
// Read these as functions to ensure fresh values in dev mode
const getMaxDimension = () => parseInt(process.env.NEXT_PUBLIC_HEIC_MAX_DIMENSION || '2048', 10);
const getJpegQuality = () => {
  const rawQuality = parseInt(process.env.NEXT_PUBLIC_HEIC_JPEG_QUALITY || '82', 10);
  const normalized = rawQuality / 100;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Image Validation] Using JPEG quality: ${rawQuality}% (${normalized})`);
  }
  return normalized;
};

/**
 * Resize image to max dimension using Canvas API
 * @param file - Image file to resize
 * @param maxDimension - Maximum width or height
 * @returns Resized image file
 */
async function resizeImage(file: File, maxDimension: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const { width, height } = img;
      const longSide = Math.max(width, height);
      
      // Even if image is already small enough, re-encode to JPEG for optimization
      const shouldResize = longSide > maxDimension;
      if (!shouldResize) {
        console.log(`[Image Validation] Image ${width}x${height} is within limits, re-encoding to JPEG`);
      }
      
      // Calculate new dimensions maintaining aspect ratio
      const scale = shouldResize ? maxDimension / longSide : 1.0;
      const newWidth = Math.round(width * scale);
      const newHeight = Math.round(height * scale);
      
      if (shouldResize) {
        console.log(`[Image Validation] Resizing image from ${width}x${height} to ${newWidth}x${newHeight}`);
      }
      
      // Create canvas and resize
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      
      // Convert to blob with quality setting
      const quality = getJpegQuality();
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create resized image blob'));
            return;
          }
          
          // Update filename to .jpg extension
          const outputName = file.name.replace(/\.(png|webp|jpeg|heic|heif)$/i, '.jpg').replace(/\.jpg\.jpg$/i, '.jpg');
          const resizedFile = new File([blob], outputName, {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          });
          
          const reduction = ((1 - resizedFile.size / file.size) * 100).toFixed(1);
          console.log(`[Image Validation] Resized ${file.size} → ${resizedFile.size} bytes (${reduction}% reduction)`);
          
          resolve(resizedFile);
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for resizing'));
    };
    
    img.src = url;
  });
}

/**
 * Convert HEIC file to JPEG
 * Uses heic2any library for client-side conversion
 */
async function convertHeicViaServer(file: File): Promise<File> {
  if (typeof fetch === 'undefined') {
    throw new Error('Fetch API not available for server-based conversion.');
  }

  console.log('[Image Validation] Falling back to server HEIC conversion for:', file.name);
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await fetch('/api/convert-heic', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `Server conversion failed with status ${response.status}`);
  }

  const blob = await response.blob();
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('Server conversion response was empty');
  }

  const convertedFile = new File(
    [blob],
    file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'),
    {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    }
  );

  console.log('[Image Validation] Server HEIC conversion successful, size:', convertedFile.size);
  return convertedFile;
}

async function loadHeic2Any(): Promise<any | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const heicModule = await import('heic2any');
    const converter = heicModule.default || heicModule;
    if (typeof converter === 'function') {
      console.log('[Image Validation] heic2any loaded:', typeof converter);
      return converter;
    }
    console.warn('[Image Validation] heic2any module did not export a function');
  } catch (error) {
    console.warn('[Image Validation] heic2any unavailable, using server fallback:', error);
  }

  return null;
}

export async function convertHEICtoJPEG(file: File): Promise<File> {
  console.log('[Image Validation] Starting HEIC conversion for:', file.name, file.type, file.size);

  const heic2any = await loadHeic2Any();

  if (heic2any) {
    try {
      console.log('[Image Validation] Calling heic2any conversion...');
      const quality = getJpegQuality();
      const maxDim = getMaxDimension();
      console.log(`[Image Validation] Settings: quality=${quality}, maxDimension=${maxDim}`);
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: quality,
      });
      console.log('[Image Validation] Conversion complete, result type:', typeof convertedBlob, Array.isArray(convertedBlob));

      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      if (!blob || !(blob instanceof Blob)) {
        throw new Error('Conversion produced invalid result');
      }

      console.log('[Image Validation] Creating File from Blob, size:', blob.size);

      let convertedFile = new File(
        [blob],
        file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'),
        {
          type: 'image/jpeg',
          lastModified: file.lastModified,
        }
      );

      console.log('[Image Validation] Initial conversion size:', convertedFile.size);

      try {
        convertedFile = await resizeImage(convertedFile, getMaxDimension());
        console.log('[Image Validation] Final optimized size:', convertedFile.size);
      } catch (resizeError) {
        console.warn('[Image Validation] Client-side resize failed, using unresized:', resizeError);
      }

      return convertedFile;
    } catch (error) {
      console.warn('[Image Validation] Browser HEIC conversion failed, falling back to server:', error);
    }
  }

  try {
    return await convertHeicViaServer(file);
  } catch (serverError) {
    console.error('[Image Validation] Server HEIC conversion fallback failed:', serverError);
    const message =
      serverError instanceof Error ? serverError.message : 'Unknown server conversion error';
    throw new Error(`Failed to convert HEIC image automatically: ${message}`);
  }
}

/**
 * Validate and convert image file if needed
 * 
 * @param file - File to validate
 * @param maxBytes - Maximum file size in bytes
 * @returns Validation result with converted file if applicable
 */
export async function validateAndConvertImage(
  file: File,
  maxBytes: number
): Promise<ImageValidationResult> {
  try {
    // Step 1: Validate file type
    if (!isValidImageType(file)) {
      return {
        valid: false,
        error: 'invalid_type',
        message: 'Only image files are allowed (JPEG, PNG, WebP, HEIC)',
      };
    }

    // Step 2: Validate file size (before conversion)
    if (file.size > maxBytes) {
      return {
        valid: false,
        error: 'file_too_large',
        message: `File too large. Maximum size: ${Math.round(maxBytes / 1024 / 1024)}MB`,
      };
    }

    // Step 3: Convert HEIC to JPEG (required for API compatibility)
    let processedFile = file;
    if (isHEIC(file)) {
      console.log('[Image Validation] HEIC file detected, conversion to JPEG required for API compatibility');
      
      try {
        processedFile = await convertHEICtoJPEG(file);
        console.log('[Image Validation] HEIC successfully converted to JPEG');

        // Validate size again after conversion
        if (processedFile.size > maxBytes) {
          return {
            valid: false,
            error: 'file_too_large',
            message: `Converted file too large. Maximum size: ${Math.round(maxBytes / 1024 / 1024)}MB`,
          };
        }
      } catch (conversionError) {
        console.error('[Image Validation] HEIC conversion failed:', conversionError);
        
        // HEIC conversion failed - must reject
        // Backend APIs (segmentation, measurement) don't support HEIC format
        return {
          valid: false,
          error: 'conversion_failed',
          message: 'We could not process this HEIC image automatically. Please try again.',
        };
      }
    } else {
      // Step 4: Resize regular images (JPG, PNG, WebP) to optimize upload
      console.log('[Image Validation] Optimizing image for upload:', file.name, file.type, file.size);
      try {
        processedFile = await resizeImage(file, getMaxDimension());
        console.log('[Image Validation] Image optimized:', processedFile.size, 'bytes');
        
        // Validate size again after resize
        if (processedFile.size > maxBytes) {
          return {
            valid: false,
            error: 'file_too_large',
            message: `Optimized file too large. Maximum size: ${Math.round(maxBytes / 1024 / 1024)}MB`,
          };
        }
      } catch (resizeError) {
        console.warn('[Image Validation] Client-side resize failed, using original:', resizeError);
        // Continue with original file if resize fails
        processedFile = file;
      }
    }

    return {
      valid: true,
      file: processedFile,
    };
  } catch (error) {
    console.error('[Image Validation] Unexpected error:', error);
    return {
      valid: false,
      error: 'unknown_error',
      message: 'An unexpected error occurred while processing the image',
    };
  }
}

/**
 * Get user-friendly error message for validation errors
 */
export function getValidationErrorMessage(error: ImageValidationError): string {
  switch (error) {
    case 'invalid_type':
      return 'Invalid file type. Please upload a JPEG, PNG, WebP, or HEIC image.';
    case 'file_too_large':
      return 'File is too large. Please choose a smaller image.';
    case 'conversion_failed':
      return 'Failed to process HEIC image automatically. Please try again.';
    case 'unknown_error':
      return 'An unexpected error occurred. Please try again.';
    default:
      return 'Invalid image file';
  }
}
