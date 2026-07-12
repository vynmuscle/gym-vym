import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';
import { renderNav } from './navigation.js';
import { initPWA } from './pwa.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('../login.html');
initPWA();

await renderNav('evolution');
