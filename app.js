// ===== CONFIGURATION : colle ici tes valeurs (Supabase > Project Settings > API) =====
const SUPABASE_URL = 'https://frfgwhvaypnwbbodsaxa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FEla-tWS2BxXiAKY8V3tUw_ggVBoR58'; // JAMAIS la clé "service_role"

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById('app');
const ROLES = ['direction', 'administrateur', 'technique'];
let me = null, idleTimer = null;

// ---------- Outils ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fdate = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const age = d => d ? Math.floor((Date.now() - new Date(d)) / 31557600000) + ' ans' : '';
const isDir = () => me?.role === 'direction';
const $ = id => document.getElementById(id);
function toast(msg, bad) {
  const t = $('toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  setTimeout(() => (t.className = ''), 3200);
}

// ---------- Session ----------
async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return route();
  const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  me = data;
  if (!me || !me.actif || !['direction', 'administrateur'].includes(me.role)) return pendingView();
  watchIdle();
  route();
}
async function logout() { await sb.auth.signOut(); me = null; location.hash = '#/'; route(); }
function watchIdle() { // déconnexion automatique après 20 min d'inactivité
  const reset = () => { clearTimeout(idleTimer); idleTimer = setTimeout(logout, 20 * 60 * 1000); };
  if (!watchIdle.on) { ['click', 'keydown', 'mousemove'].forEach(e => addEventListener(e, () => me && reset())); watchIdle.on = true; }
  reset();
}

// ---------- Vues ----------
function loginView() {
  app.innerHTML = `<div class="login">
    <aside><img src="assets/logo-clair.png" alt="Logo de l’orphelinat"><h1>Orphelinat Emmanuel</h1><p>Un foyer, une famille, un avenir.</p></aside>
    <form id="lf">
      <div><h2>Connexion</h2><p class="muted">Espace réservé au personnel autorisé.</p></div>
      <label>Adresse e-mail<input type="email" name="email" required autocomplete="username"></label>
      <label>Mot de passe<input type="password" name="password" required autocomplete="current-password"></label>
      <button class="btn">Se connecter</button>
      <a class="back" href="#/">Retour à l’accueil</a>
    </form></div>`;
  $('lf').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
    if (error) return toast('E-mail ou mot de passe incorrect.', true);
    await start();
    location.hash = '#/';
  };
}
function pendingView() {
  app.innerHTML = `<div class="login solo"><div class="card"><div class="mark">OE</div><h2>Accès en attente</h2>
    <p class="muted">Votre compte n’est pas encore activé ou n’a pas accès aux dossiers. Contactez la direction.</p>
    <button class="btn" id="out">Se déconnecter</button></div></div>`;
  $('out').onclick = logout;
}
// En-tête commun : le menu change selon que la personne est connectée ou non
function nav(active) {
  const link = (href, text, key) => `<a href="${href}" class="${active === key ? 'on' : ''}">${text}</a>`;
  const menu = link('#/', 'Accueil', 'home') + (me ? link('#/dossiers', 'Dossiers', 'list') + link('#/nouveau', 'Ajouter un enfant', 'new') + (isDir() ? link('#/equipe', 'Équipe', 'team') : '') : '');
  const side = me ? `<span>${esc(me.nom_complet || 'Utilisateur')}</span><button class="btn ghost small" id="out">Se déconnecter</button>` : '<a class="btn gold" href="#/connexion">Se connecter</a>';
  return `<header class="top"><a class="brand" href="#/"><img src="assets/logo-clair.png" alt="">Orphelinat Emmanuel</a><nav>${menu}</nav><div class="who">${side}</div></header>`;
}
function shell(html, active) {
  app.innerHTML = nav(active) + `<main>${html}</main>`;
  if ($('out')) $('out').onclick = logout;
}

// ---------- Routage ----------
const canUse = () => me && me.actif && ['direction', 'administrateur'].includes(me.role);
function route() {
  if (me && !canUse()) return pendingView();
  const [, page, id] = location.hash.split('/');
  if (!me) return page === 'connexion' ? loginView() : homeView();
  if (page === 'enfant') return childView(id);
  if (page === 'nouveau') return formView();
  if (page === 'modifier') return formView(id);
  if (page === 'dossiers') return listView();
  if (page === 'equipe' && isDir()) return teamView();
  homeView();
}
addEventListener('hashchange', route);

// ---------- Accueil et recherche ----------
let pendingQ = '', searchSeq = 0;
const debounce = (fn, ms = 250) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
function homeView() {
  app.innerHTML = nav('home') + `<section class="hero"><img class="wm" src="assets/logo-clair.png" alt="">
    <div class="hero-in"><h1>Retrouver le dossier d’un enfant</h1><p>Un foyer, une famille, un avenir.</p>
    <label for="q">Rechercher un dossier</label>
    <div class="search"><input id="q" type="search" placeholder="Matricule ou nom de l’enfant" autocomplete="off" value="${esc(pendingQ)}"><button class="btn" id="go">Rechercher</button></div>
    <p class="hint">${me ? 'Tapez un matricule ou un nom : les résultats s’affichent aussitôt.' : 'Les fiches et les documents s’affichent après la connexion du personnel.'}</p>
    <div id="res"></div></div></section>`;
  if (me) $('out').onclick = logout;
  const run = () => {
    const q = $('q').value.trim();
    if (!me) { if (q) { pendingQ = q; location.hash = '#/connexion'; } return; }
    searchChildren(q);
  };
  $('go').onclick = run;
  $('q').onkeydown = e => { if (e.key === 'Enter') run(); };
  if (me) { $('q').oninput = debounce(run); if (pendingQ) { run(); pendingQ = ''; } }
}
async function searchChildren(q) {
  const box = $('res'), mine = ++searchSeq;
  if (q.length < 2) { box.innerHTML = ''; return; }
  const t = q.replace(/[%,()*]/g, ' ');
  const { data } = await sb.from('enfants').select('id,matricule,nom,prenoms,date_naissance,statut')
    .or(`matricule.ilike.%${t}%,nom.ilike.%${t}%,prenoms.ilike.%${t}%`).order('nom').limit(12);
  if (mine !== searchSeq || !$('res')) return; // une recherche plus récente a pris le relais
  box.innerHTML = (data || []).length ? data.map(r => `<a class="res" href="#/enfant/${r.id}"><span class="mat">${esc(r.matricule)}</span>
    <span><b>${esc(r.nom)}</b> ${esc(r.prenoms)}</span><small>${age(r.date_naissance)}</small><span class="pill ${esc(r.statut)}">${esc(r.statut)}</span></a>`).join('')
    : '<p class="none">Aucun dossier ne correspond à cette recherche.</p>';
}

// ---------- Liste des enfants ----------
async function listView() {
  const { data } = await sb.from('enfants').select('id,matricule,nom,prenoms,date_naissance,date_admission,statut').order('nom');
  const rows = data || [], year = String(new Date().getFullYear());
  const stats = [['Enfants enregistrés', rows.length], ['Dossiers actifs', rows.filter(r => r.statut === 'Actif').length],
    ['Admissions cette année', rows.filter(r => (r.date_admission || '').startsWith(year)).length]];
  shell(`<div class="head"><div><p class="muted" style="margin:0">Bonjour, ${esc(me.nom_complet)}</p><h1>Dossiers des enfants</h1></div>
    <a class="btn" href="#/nouveau">Ajouter un enfant</a></div>
    <div class="stats">${stats.map(([l, v]) => `<div class="card stat"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
    <div class="card"><div class="bar"><input id="q" placeholder="Rechercher un nom ou un matricule" aria-label="Rechercher">
    <select id="st" aria-label="Statut"><option value="">Tous les statuts</option><option>Actif</option><option>Sorti</option><option>Archivé</option></select></div>
    <div class="tw"><table><thead><tr><th>Matricule</th><th>Nom et prénoms</th><th>Âge</th><th>Admission</th><th>Statut</th></tr></thead><tbody id="rows"></tbody></table></div></div>`, 'list');
  const draw = () => {
    const q = $('q').value.toLowerCase(), s = $('st').value;
    const list = rows.filter(r => (!s || r.statut === s) && `${r.matricule} ${r.nom} ${r.prenoms}`.toLowerCase().includes(q));
    $('rows').innerHTML = list.length ? list.map(r => `<tr><td class="mat">${esc(r.matricule)}</td>
      <td><a href="#/enfant/${r.id}"><b>${esc(r.nom)}</b> ${esc(r.prenoms)}</a></td><td>${age(r.date_naissance) || '—'}</td>
      <td>${fdate(r.date_admission)}</td><td><span class="pill ${esc(r.statut)}">${esc(r.statut)}</span></td></tr>`).join('')
      : `<tr><td colspan="5" class="empty">${rows.length ? 'Aucun résultat.' : 'Aucun dossier pour l’instant. Ajoutez le premier enfant.'}</td></tr>`;
  };
  $('q').oninput = draw; $('st').onchange = draw; draw();
}

// ---------- Fiche enfant ----------
async function childView(id) {
  const [a, b] = await Promise.all([
    sb.from('enfants').select('*').eq('id', id).single(),
    sb.from('documents').select('*').eq('enfant_id', id).order('created_at', { ascending: false })]);
  const c = a.data, docs = b.data || [];
  if (!c) { toast('Dossier introuvable.', true); return (location.hash = '#/'); }
  const facts = [['Naissance', `${fdate(c.date_naissance)} ${age(c.date_naissance)}`], ['Lieu de naissance', c.lieu_naissance], ['Sexe', c.sexe],
    ['Admission', fdate(c.date_admission)], ['Provenance', c.provenance], ['Motif d’admission', c.motif_admission], ['Remarques', c.remarques]];
  shell(`<div class="card profile"><div class="avatar">${esc((c.prenoms || '?')[0].toUpperCase())}</div>
    <div class="grow"><h1>${esc(c.nom)} ${esc(c.prenoms)}</h1><p class="muted" style="margin:4px 0">Matricule <span class="mat">${esc(c.matricule)}</span>
    <span class="pill ${esc(c.statut)}">${esc(c.statut)}</span></p></div>
    <a class="btn ghost" href="#/">Retour à l’accueil</a>
    <a class="btn ghost" href="#/modifier/${id}">Modifier la fiche</a>
    ${c.statut !== 'Archivé' ? '<button class="btn danger" id="arch">Archiver</button>' : ''}</div>
    <div class="card"><h2 style="margin-bottom:16px">Informations</h2><div class="facts">${facts.map(([l, v]) => `<div><small>${l}</small><p>${esc(v) || '—'}</p></div>`).join('')}</div></div>
    <div class="card"><h2>Documents</h2>${docs.length ? docs.map(d => `<div class="doc"><div><b>${esc(d.titre)}</b>
    <small>${esc(d.type || 'Autre')}, ajouté le ${fdate(d.created_at)}, ${Math.round((d.taille || 0) / 1024)} Ko</small></div>
    <button class="btn ghost small" data-p="${esc(d.chemin)}">Ouvrir</button></div>`).join('') : '<p class="muted">Aucun document. Ajoutez l’acte de naissance, le carnet de santé…</p>'}
    <form id="up" class="up"><label>Titre<input name="titre" required></label>
    <label>Type<select name="type"><option>Acte de naissance</option><option>Carnet de santé</option><option>Scolarité</option><option>Décision de placement</option><option>Autre</option></select></label>
    <label class="wide" style="grid-column:1/-1">Fichier (PDF, JPG ou PNG, 10 Mo max)<input type="file" name="fichier" accept=".pdf,.jpg,.jpeg,.png" required></label>
    <button class="btn">Ajouter le document</button></form></div>`);
  document.querySelectorAll('[data-p]').forEach(btn => (btn.onclick = async () => {
    const w = window.open('about:blank');
    const { data, error } = await sb.storage.from('documents').createSignedUrl(btn.dataset.p, 60); // lien valable 60 s
    if (error) { w.close(); return toast('Ouverture impossible.', true); }
    w.location = data.signedUrl;
  }));
  if ($('arch')) $('arch').onclick = async () => {
    if (!confirm('Archiver ce dossier ? Il sera conservé, sans suppression.')) return;
    const { error } = await sb.from('enfants').update({ statut: 'Archivé' }).eq('id', id);
    error ? toast('Archivage impossible.', true) : (toast('Dossier archivé.'), childView(id));
  };
  $('up').onsubmit = async e => {
    e.preventDefault();
    const f = e.target.fichier.files[0];
    if (!f) return;
    if (f.size > 10485760) return toast('Le fichier dépasse 10 Mo.', true);
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) return toast('Formats acceptés : PDF, JPG, PNG.', true);
    const path = `${id}/${crypto.randomUUID()}.${f.name.split('.').pop().toLowerCase()}`;
    const up = await sb.storage.from('documents').upload(path, f, { contentType: f.type });
    if (up.error) return toast('Téléversement impossible.', true);
    const ins = await sb.from('documents').insert({ enfant_id: id, titre: e.target.titre.value, type: e.target.type.value, chemin: path, mime: f.type, taille: f.size });
    ins.error ? toast('Enregistrement du document impossible.', true) : (toast('Document ajouté.'), childView(id));
  };
}

// ---------- Création / modification ----------
async function formView(id) {
  let c = {};
  if (id) ({ data: c } = await sb.from('enfants').select('*').eq('id', id).single());
  c = c || {};
  const F = (n, l, t = 'text', req = false) => `<label>${l}<input name="${n}" type="${t}" value="${esc(c[n])}" ${req ? 'required' : ''}></label>`;
  shell(`<div class="head"><h1>${id ? 'Modifier la fiche' : 'Ajouter un enfant'}</h1><a class="btn ghost" href="#/${id ? 'enfant/' + id : ''}">Annuler</a></div>
    <form id="f" class="card form"><div class="grid">${F('matricule', 'Matricule (ex. OEG-001) *', 'text', 1)}${F('nom', 'Nom *', 'text', 1)}${F('prenoms', 'Prénoms *', 'text', 1)}
    <label>Sexe<select name="sexe">${['Non renseigné', 'Masculin', 'Féminin'].map(x => `<option ${x === c.sexe ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    ${F('date_naissance', 'Date de naissance', 'date')}${F('lieu_naissance', 'Lieu de naissance')}${F('date_admission', 'Date d’admission', 'date')}${F('provenance', 'Provenance')}
    <label class="wide">Motif d’admission<textarea name="motif_admission" rows="3">${esc(c.motif_admission)}</textarea></label>
    <label class="wide">Remarques<textarea name="remarques" rows="3">${esc(c.remarques)}</textarea></label></div>
    <button class="btn">Enregistrer la fiche</button></form>`, id ? 'list' : 'new');
  $('f').onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    for (const k in d) if (d[k] === '') d[k] = null;
    const q = id ? sb.from('enfants').update(d).eq('id', id) : sb.from('enfants').insert(d);
    const { data, error } = await q.select('id').single();
    if (error) return toast(error.code === '23505' ? 'Ce matricule existe déjà.' : 'Enregistrement impossible.', true);
    toast('Fiche enregistrée.'); location.hash = '#/enfant/' + data.id;
  };
}

// ---------- Équipe (direction uniquement) ----------
async function teamView() {
  const { data } = await sb.from('profiles').select('*').order('nom_complet');
  shell(`<div class="head"><h1>Équipe</h1></div><div class="card">
    <p class="muted">Pour ajouter une personne : créez son compte dans Supabase (voir GUIDE.md), puis activez-la ici et choisissez son rôle.</p>
    <div class="tw"><table><thead><tr><th>Nom complet</th><th>Rôle</th><th>Actif</th><th></th></tr></thead><tbody>${(data || []).map(p => `
    <tr data-id="${p.id}"><td><input value="${esc(p.nom_complet)}" aria-label="Nom complet"></td>
    <td><select aria-label="Rôle">${ROLES.map(r => `<option ${r === p.role ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
    <td><input type="checkbox" ${p.actif ? 'checked' : ''} aria-label="Actif"></td><td><button class="btn small">Enregistrer</button></td></tr>`).join('')}
    </tbody></table></div></div>`, 'team');
  document.querySelectorAll('tr[data-id]').forEach(tr => (tr.querySelector('button').onclick = async () => {
    const [n, r, a] = tr.querySelectorAll('input,select');
    if (tr.dataset.id === me.id && (!a.checked || r.value !== 'direction')) return toast('Vous ne pouvez pas retirer votre propre accès.', true);
    const { error } = await sb.from('profiles').update({ nom_complet: n.value.trim(), role: r.value, actif: a.checked }).eq('id', tr.dataset.id);
    error ? toast('Mise à jour impossible.', true) : toast('Compte mis à jour.');
  }));
}

start();
