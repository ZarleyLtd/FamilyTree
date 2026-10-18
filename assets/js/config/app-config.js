/**
 * FamilyTree app configuration.
 * API_URL is the shared Apps project Edge Function.
 */
var FAMILYTREE_CONFIG = {
  API_URL: 'https://yzyipxvlsoxfphwobfkb.supabase.co/functions/v1/familytree-api',
  BUCKET_URL: 'https://yzyipxvlsoxfphwobfkb.supabase.co/storage/v1/object/public/familytree/',
  IMAGE_TARGET_BYTES: 100 * 1024,
  IMAGE_MAX_EDGE: 1080
};
