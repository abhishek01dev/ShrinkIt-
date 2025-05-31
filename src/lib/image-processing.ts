// src/lib/image-processing.ts
"use client";

/**
 * Resizes and compresses an image file.
 * @param file The image file to process.
 * @param targetWidth The desired width of the output image.
 * @param targetHeight The desired height of the output image.
 * @param quality A number between 0 and 100 representing the JPEG quality.
 * @returns A Promise that resolves with the data URL of the processed image.
 */
export async function resizeAndCompressImage(
  file: File,
  targetWidth: number,
  targetHeight: number,
  quality: number // 0-100
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) {
        reject(new Error("Failed to read file."));
        return;
      }

      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // Ensure width and height are positive
        const finalWidth = Math.max(1, targetWidth);
        const finalHeight = Math.max(1, targetHeight);

        canvas.width = finalWidth;
        canvas.height = finalHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Fill background with white if original is transparent and output is JPEG
        // This prevents black backgrounds on some browsers for transparent PNGs -> JPEGs
        if (file.type === 'image/png' || file.type === 'image/gif') { // Check if original could have transparency
            ctx.fillStyle = '#FFFFFF'; // White background
            ctx.fillRect(0, 0, finalWidth, finalHeight);
        }
        
        ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
        
        // Convert quality from 0-100 to 0-1 range for toDataURL
        const jpegQuality = Math.max(0.01, Math.min(1, quality / 100));
        
        try {
            const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
            resolve(dataUrl);
        } catch (e) {
            reject(new Error(`Failed to convert canvas to Data URL: ${e instanceof Error ? e.message : String(e)}`));
        }
      };
      img.onerror = (errorEvent) => {
        reject(new Error(`Failed to load image for processing. Error: ${JSON.stringify(errorEvent)}`));
      };
      img.src = event.target.result as string;
    };
    reader.onerror = () => {
      reject(new Error("File reading failed."));
    };
    reader.readAsDataURL(file);
  });
}
