/**
 * convertToWebP — Client-side image → WebP conversion using Canvas API.
 *
 * Converts any image File (JPEG, PNG, HEIC, etc.) to WebP format.
 * Also downscales if larger than maxDimension to keep file sizes small.
 *
 * @param file      - Original image File
 * @param quality   - WebP quality 0-1 (default 0.82)
 * @param maxDim    - Max width/height in px (default 2048)
 * @returns         - New File object with .webp extension
 */
export async function convertToWebP(
    file: File,
    quality: number = 0.82,
    maxDim: number = 2048
): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Calculate scaled dimensions
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
                const ratio = Math.min(maxDim / width, maxDim / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            // Draw to canvas
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Canvas context not available"));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to WebP blob
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error("WebP conversion failed"));
                        return;
                    }
                    // Create new File with .webp extension
                    const baseName = file.name.replace(/\.[^.]+$/, "");
                    const webpFile = new File([blob], `${baseName}.webp`, {
                        type: "image/webp",
                        lastModified: Date.now(),
                    });
                    resolve(webpFile);
                },
                "image/webp",
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`Failed to load image: ${file.name}`));
        };

        img.src = url;
    });
}

/**
 * Convert multiple files to WebP in parallel.
 * Returns array of converted Files + previews.
 */
export async function convertBatchToWebP(
    files: File[],
    quality: number = 0.82,
    maxDim: number = 2048,
    onProgress?: (done: number, total: number) => void
): Promise<{ file: File; preview: string }[]> {
    const results: { file: File; preview: string }[] = [];
    const total = files.length;

    // Process in batches of 5 to prevent memory issues
    const BATCH_SIZE = 5;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const converted = await Promise.all(
            batch.map(async (file) => {
                const webp = await convertToWebP(file, quality, maxDim);
                const preview = URL.createObjectURL(webp);
                return { file: webp, preview };
            })
        );
        results.push(...converted);
        onProgress?.(Math.min(i + BATCH_SIZE, total), total);
    }

    return results;
}
