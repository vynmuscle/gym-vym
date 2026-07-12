import { supabase } from '../supabaseClient.js';

const BUCKET = 'progress-photos';
const SIGNED_URL_TTL = 300; // 5 minutos — geradas a cada carregamento, nunca persistidas

export async function listPhotos(userId) {
  const { data, error } = await supabase
    .from('progress_photos')
    .select('*')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function uploadPhoto(userId, blob) {
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false
  });
  if (error) throw error;
  return path;
}

export async function createPhoto(userId, payload) {
  const { data, error } = await supabase
    .from('progress_photos')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePhoto(id, storagePath) {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (storageError) throw storageError;

  const { error } = await supabase.from('progress_photos').delete().eq('id', id);
  if (error) throw error;
}

export async function getSignedUrls(paths) {
  if (paths.length === 0) return {};

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  if (error) throw error;

  const map = {};
  data.forEach(item => { map[item.path] = item.signedUrl; });
  return map;
}
