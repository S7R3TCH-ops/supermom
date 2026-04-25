import { supabase } from './supabase';

const BUCKET = 'job-assets';

/**
 * Uploads a file (photo or voice blob) to a private job-assets bucket.
 * Organizes by jobId/type/timestamp.
 * @param {string} jobId 
 * @param {File|Blob} file 
 * @param {'photo'|'voice'} type 
 * @returns {Promise<string>} The storage path (e.g. "uuid/photos/file.jpg")
 */
export async function uploadFile(jobId, file, type = 'photo') {
  // Extract extension or default to webm for audio
  const ext = file.name ? file.name.split('.').pop() : 'webm';
  const fileName = `${type}_${Date.now()}.${ext}`;
  const path = `${jobId}/${type}s/${fileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false });

  if (error) throw error;
  return data.path; // Returns the internal path
}

/**
 * Generates temporary signed URLs for a list of storage paths.
 * @param {string[]} paths 
 * @returns {Promise<string[]>} List of signed URLs
 */
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

/**
 * Helper for a single path.
 * @param {string} path 
 * @returns {Promise<string|null>}
 */
export async function getSignedUrl(path) {
  if (!path) return null;
  const urls = await getSignedUrls([path]);
  return urls[0];
}
