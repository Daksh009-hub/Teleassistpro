// Canvas-based client-side Watermarking for KYC Documents

export async function applyLICWatermark(imageFileOrUrl, watermarkText = 'Only for LIC | Confidential') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original document image
        ctx.drawImage(img, 0, 0);

        // Watermark styling
        const fontSize = Math.max(24, Math.floor(canvas.width / 22));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(220, 53, 69, 0.35)'; // semi-transparent red watermark
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 6); // -30 degrees diagonal

        const text = watermarkText;
        const subText = `Verified on ${new Date().toLocaleDateString('en-IN')}`;

        // Repeat pattern across document
        const stepY = fontSize * 4;
        const stepX = fontSize * 12;

        for (let y = -canvas.height; y < canvas.height; y += stepY) {
          for (let x = -canvas.width; x < canvas.width; x += stepX) {
            ctx.fillText(text, x, y);
            ctx.strokeText(text, x, y);
            ctx.fillText(subText, x, y + fontSize * 0.9);
          }
        }

        ctx.restore();

        // Convert canvas to Data URL & Blob
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        canvas.toBlob((blob) => {
          resolve({
            dataUrl,
            blob,
            width: canvas.width,
            height: canvas.height
          });
        }, 'image/jpeg', 0.92);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => reject(new Error('Failed to load image for watermarking'));

    if (typeof imageFileOrUrl === 'string') {
      img.src = imageFileOrUrl;
    } else if (imageFileOrUrl instanceof Blob || imageFileOrUrl instanceof File) {
      img.src = URL.createObjectURL(imageFileOrUrl);
    } else {
      reject(new Error('Invalid image input'));
    }
  });
}
