export async function uploadImageToCloudinary(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UNSIGNED_UPLOAD_PRESET as string | undefined;
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary not configured (VITE_CLOUDINARY_* env vars missing)');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cloudinary upload failed: ${res.status} ${res.statusText} ${text}`);
  }

  const data = await res.json();
  if (!data) throw new Error('Empty response from Cloudinary');
  return data.secure_url || data.url;
}

export default uploadImageToCloudinary;
