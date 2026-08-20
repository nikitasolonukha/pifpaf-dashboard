import { createServiceClient } from '@/lib/supabase/server';

export async function uploadCover(sourceUrl, userId, shortcode) {
  if (!sourceUrl) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        // Some CDNs behave better with UA; doesn't leak secrets.
        'User-Agent': 'PifPafAI/cover-downloader',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    // Keep TЗ path `.jpg` by allowing only JPEG bytes.
    if (!contentType.toLowerCase().includes('image/jpeg')) return null;

    const bufferArray = await res.arrayBuffer();
    // Size limit for safety: 5MB.
    if (bufferArray.byteLength > 5 * 1024 * 1024) return null;

    const buffer = Buffer.from(bufferArray);
    const path = `${userId}/${shortcode}.jpg`;
    const supabase = createServiceClient();

    const { error } = await supabase.storage
      .from('reel-covers')
      .upload(path, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error('Cover upload error:', error.message);
      return null;
    }

    const { data } = supabase.storage.from('reel-covers').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error('Cover download error:', err.message);
    return null;
  }
}
