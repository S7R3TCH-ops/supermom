import { supabase } from './supabase';

const BUCKET = 'job-assets';

export async function uploadFile(jobId, file, type = 'photo') {
  const ext = file.name ? file.name.split('.').pop() : 'webm';
  const fileName = `${type}_${Date.now()}.${ext}`;
  const path = `${jobId}/${type}s/${fileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false });

  if (error) throw error;
  return data.path;
}

export async function uploadAsset(businessId, file, category = 'logos') {
  const ext = file.name.split('.').pop();
  const fileName = `${category}_${Date.now()}.${ext}`;
  const path = `assets/${businessId}/${category}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true });

  if (error) throw error;
  return data.path;
}

export async function getSignedUrls(paths) {
  if (!paths || paths.length === 0) return [];
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, 3600); // 1 hour expiry

  if (error) {
    console.error('[storage] Failed to get signed URLs', error);
    return paths.map(() => null);
  }
  return data.map((d) => d.signedUrl || null);
}

export async function getSignedUrl(path) {
  if (!path) return null;
  const urls = await getSignedUrls([path]);
  return urls[0];
}
