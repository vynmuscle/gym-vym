import { supabase } from './supabaseClient.js';
import { navigate } from './router.js';

const { data: sd } = await supabase.auth.getSession();
if(!sd.session) navigate('./login.html');
const user = sd.session.user;

document.getElementById('userEmail').innerText = user.email;

document.getElementById('btnLogout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  navigate('./login.html');
});
