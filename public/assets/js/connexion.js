import { supabase, profilCourant, destination } from './supabase.js';
import { $, el, setBusy, clean, enregistrerSW } from './ui.js';

enregistrerSW();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const blocs = { auth: $('#bloc-auth'), reset: $('#form-reset'), newpass: $('#form-newpass') };

function message(texte, type = 'err') {
  const zone = $('#message');
  zone.replaceChildren();
  if (texte) zone.append(el('div', { class: `alert alert-${type}`, text: texte }));
}

function afficher(nom) {
  for (const [k, b] of Object.entries(blocs)) b.classList.toggle('hidden', k !== nom);
  message('');
}

function mode(m) {
  const signup = m === 'signup';
  $('#tab-login').setAttribute('aria-selected', String(!signup));
  $('#tab-signup').setAttribute('aria-selected', String(signup));
  $('#form-login').classList.toggle('hidden', signup);
  $('#form-signup').classList.toggle('hidden', !signup);
  message('');
}

async function entrer() {
  const profil = await profilCourant();
  location.replace(destination(profil && profil.role));
}

$('#tab-login').addEventListener('click', () => mode('login'));
$('#tab-signup').addEventListener('click', () => mode('signup'));
$('#lien-oubli').addEventListener('click', () => afficher('reset'));
$('#retour-login').addEventListener('click', () => afficher('auth'));

// Connexion
$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = clean($('#l-email').value, 160).toLowerCase();
  const password = $('#l-pass').value;
  if (!EMAIL.test(email) || !password) return message('Renseigne ton e-mail et ton mot de passe.');
  const btn = $('#btn-login');
  setBusy(btn, true, 'Connexion…');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  setBusy(btn, false);
  if (error) return message('E-mail ou mot de passe incorrect.'); // message volontairement identique
  entrer();
});

// Inscription
$('#form-signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nom = clean($('#s-nom').value, 80);
  const email = clean($('#s-email').value, 160).toLowerCase();
  const password = $('#s-pass').value;
  const code = $('#s-code').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16);
  if (nom.length < 2) return message('Entre ton nom complet.');
  if (!EMAIL.test(email)) return message('Adresse e-mail invalide.');
  if (password.length < 8) return message('Mot de passe : 8 caractères minimum.');
  const btn = $('#btn-signup');
  setBusy(btn, true, 'Création…');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nom, code }, emailRedirectTo: `${location.origin}/connexion` },
  });
  setBusy(btn, false);
  if (error) return message("Inscription impossible. Vérifie tes informations ou connecte-toi si tu as déjà un compte.");
  if (data.session) return entrer();
  mode('login');
  message('Compte créé. Vérifie ta boîte e-mail pour confirmer, puis connecte-toi.', 'ok');
});

// Mot de passe oublié (réponse identique que le compte existe ou non)
$('#form-reset').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = clean($('#r-email').value, 160).toLowerCase();
  if (!EMAIL.test(email)) return message('Adresse e-mail invalide.');
  const btn = $('#btn-reset');
  setBusy(btn, true, 'Envoi…');
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/connexion` });
  setBusy(btn, false);
  message('Si un compte existe pour cet e-mail, un lien vient de lui être envoyé.', 'ok');
});

// Nouveau mot de passe (après le lien reçu par e-mail)
$('#form-newpass').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = $('#n-pass').value;
  if (password.length < 8) return message('Mot de passe : 8 caractères minimum.');
  const btn = $('#btn-newpass');
  setBusy(btn, true, 'Enregistrement…');
  const { error } = await supabase.auth.updateUser({ password });
  setBusy(btn, false);
  if (error) return message('Impossible de changer le mot de passe. Redemande un lien.');
  entrer();
});

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') afficher('newpass');
});

// Démarrage
(async () => {
  if (new URLSearchParams(location.search).get('mode') === 'signup') mode('signup');
  if (location.hash.includes('type=recovery')) return; // le lien de réinitialisation prend la main
  const profil = await profilCourant();
  if (profil) location.replace(destination(profil.role));
})();
