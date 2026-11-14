-- =====================================================================
-- ORPHELINAT EMMANUEL : AMÉLIORATIONS v3 (2026-11-14)
-- À exécuter UNE SEULE FOIS, APRÈS supabase.sql
-- (Supabase > SQL Editor > New query > coller tout le fichier > Run)
--
-- Ce fichier ajoute :
--   1. l'e-mail dans les profils (la page Équipe sait enfin qui est qui)
--   2. une protection côté base : la direction ne peut pas retirer son propre accès
--   3. le statut « Sorti » avec date et motif de sortie
--   4. des contrôles de données (matricule en majuscules, dates cohérentes)
--   5. la suppression et le remplacement des documents
--   6. un journal complet : créations, modifications, suppressions ET consultations
--   7. une règle qui OBLIGE à noter la consultation avant d'ouvrir un document
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PROFILS : ajouter l'e-mail
-- ---------------------------------------------------------------------

-- Nouvelle colonne e-mail (vide pour l'instant)
alter table public.profiles add column if not exists email text;

-- On recopie l'e-mail des comptes déjà créés depuis la table des comptes Supabase
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id;

-- Le trigger de création de compte enregistre désormais aussi l'e-mail
create or replace function public.new_user() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  insert into profiles(id, email) values (new.id, new.email);
  return new;
end
$$;


-- ---------------------------------------------------------------------
-- 2. PROFILS : protections côté base
-- ---------------------------------------------------------------------

-- Avant chaque modification d'un profil depuis le site :
--   - l'identifiant et l'e-mail ne peuvent pas être changés
--   - une personne de la direction ne peut pas se désactiver ni changer son propre rôle
-- (auth.uid() est vide dans le SQL Editor : Levi garde la main depuis Supabase)
create or replace function public.proteger_profil() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null then
    new.id := old.id;
    new.email := old.email;
    if old.id = auth.uid() and (not new.actif or new.role <> old.role) then
      raise exception 'Vous ne pouvez pas modifier votre propre accès.';
    end if;
  end if;
  new.nom_complet := trim(new.nom_complet);
  return new;
end
$$;
drop trigger if exists t_proteger_profil on public.profiles;
create trigger t_proteger_profil before update on public.profiles
  for each row execute function public.proteger_profil();

-- La règle de modification vérifie maintenant aussi la ligne APRÈS modification
drop policy if exists p_upd on public.profiles;
create policy p_upd on public.profiles for update
  using (public.is_role(array['direction']))
  with check (public.is_role(array['direction']));


-- ---------------------------------------------------------------------
-- 3 et 4. ENFANTS : sortie + contrôles des données
-- ---------------------------------------------------------------------

-- Nouvelles colonnes pour la sortie de l'enfant
alter table public.enfants add column if not exists date_sortie date;
alter table public.enfants add column if not exists motif_sortie text;

-- updated_at toujours rempli (sert à trier les « derniers dossiers modifiés »)
alter table public.enfants alter column updated_at set default now();
update public.enfants set updated_at = coalesce(updated_at, created_at, now());

-- Contrôles faits par la base à chaque création ou modification d'une fiche.
-- Les messages d'erreur s'affichent tels quels dans le site.
create or replace function public.valider_enfant() returns trigger
language plpgsql as
$$
begin
  -- Nettoyage : espaces en trop, matricule en majuscules (OEG-001 = oeg-001)
  new.matricule := upper(trim(new.matricule));
  new.nom := trim(new.nom);
  new.prenoms := trim(new.prenoms);
  if new.matricule = '' or new.nom = '' or new.prenoms = '' then
    raise exception 'Le matricule, le nom et les prénoms sont obligatoires.';
  end if;

  -- Traçabilité infalsifiable : le site ne peut pas choisir l'auteur ni la date
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.updated_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  -- Dates cohérentes
  if new.date_naissance > current_date then
    raise exception 'La date de naissance ne peut pas être dans le futur.';
  end if;
  if new.date_admission > current_date then
    raise exception 'La date d''admission ne peut pas être dans le futur.';
  end if;
  if new.date_admission < new.date_naissance then
    raise exception 'La date d''admission ne peut pas précéder la date de naissance.';
  end if;

  -- Sortie : une date est obligatoire, et elle doit être cohérente
  if new.statut = 'Sorti' and new.date_sortie is null then
    raise exception 'Indiquez la date de sortie de l''enfant.';
  end if;
  if new.date_sortie > current_date then
    raise exception 'La date de sortie ne peut pas être dans le futur.';
  end if;
  if new.date_sortie < coalesce(new.date_admission, new.date_naissance) then
    raise exception 'La date de sortie ne peut pas précéder l''admission.';
  end if;

  -- Un enfant redevenu « Actif » n'a plus de sortie
  if new.statut = 'Actif' then
    new.date_sortie := null;
    new.motif_sortie := null;
  end if;

  return new;
end
$$;
drop trigger if exists t_valider on public.enfants;
create trigger t_valider before insert or update on public.enfants
  for each row execute function public.valider_enfant();


-- ---------------------------------------------------------------------
-- 5. DOCUMENTS : contrôles, remplacement et suppression
-- ---------------------------------------------------------------------

alter table public.documents add column if not exists updated_at timestamptz;

-- Contrôles à chaque ajout ou remplacement de document
create or replace function public.valider_document() returns trigger
language plpgsql as
$$
begin
  new.titre := trim(new.titre);
  if new.titre = '' then
    raise exception 'Le titre du document est obligatoire.';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    -- Un document ne change jamais d'enfant ni d'auteur
    new.enfant_id := old.enfant_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  -- Le fichier doit être rangé dans le dossier de l'enfant : <id_enfant>/<fichier>
  if split_part(new.chemin, '/', 1) <> new.enfant_id::text then
    raise exception 'Emplacement de fichier invalide.';
  end if;
  return new;
end
$$;
drop trigger if exists t_valider_doc on public.documents;
create trigger t_valider_doc before insert or update on public.documents
  for each row execute function public.valider_document();

-- Droits : direction et administrateurs peuvent remplacer et supprimer un document
drop policy if exists d_upd on public.documents;
create policy d_upd on public.documents for update
  using (public.is_role(array['direction','administrateur']))
  with check (public.is_role(array['direction','administrateur']));
drop policy if exists d_del on public.documents;
create policy d_del on public.documents for delete
  using (public.is_role(array['direction','administrateur']));


-- ---------------------------------------------------------------------
-- 6. JOURNAL : plus de détails, et toutes les actions
-- ---------------------------------------------------------------------

-- enfant_id : pour afficher l'historique d'un enfant ; detail : phrase lisible
alter table public.journal add column if not exists enfant_id uuid;
alter table public.journal add column if not exists detail text;
create index if not exists journal_enfant_idx on public.journal (enfant_id, created_at desc);
create index if not exists journal_date_idx on public.journal (created_at desc);

-- Fonction unique qui écrit dans le journal pour les 3 tables surveillées.
-- security definer : elle écrit même si l'utilisateur n'a aucun droit d'écriture
-- sur le journal (personne ne peut écrire ni effacer le journal depuis le site).
create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as
$$
declare
  v_id uuid;       -- ligne concernée
  v_enfant uuid;   -- enfant concerné (pour son historique)
  v_detail text;   -- phrase affichée dans le journal
begin
  if tg_table_name = 'enfants' then
    v_id := new.id;
    v_enfant := new.id;
    if tg_op = 'INSERT' then
      v_detail := 'Fiche créée : ' || new.matricule;
    elsif old.statut is distinct from new.statut then
      v_detail := 'Statut changé : ' || old.statut || ' → ' || new.statut || ' (' || new.matricule || ')';
    else
      v_detail := 'Fiche modifiée : ' || new.matricule;
    end if;

  elsif tg_table_name = 'documents' then
    if tg_op = 'DELETE' then
      v_id := old.id;
      v_enfant := old.enfant_id;
      v_detail := 'Document supprimé : ' || old.titre;
    elsif tg_op = 'UPDATE' then
      v_id := new.id;
      v_enfant := new.enfant_id;
      if old.chemin is distinct from new.chemin then
        v_detail := 'Document remplacé : ' || new.titre;
      else
        v_detail := 'Document modifié : ' || new.titre;
      end if;
    else
      v_id := new.id;
      v_enfant := new.enfant_id;
      v_detail := 'Document ajouté : ' || new.titre;
    end if;

  elsif tg_table_name = 'profiles' then
    v_id := new.id;
    v_detail := 'Compte modifié : ' || coalesce(nullif(new.nom_complet, ''), new.email, 'sans nom')
      || ' (' || new.role || ', ' || case when new.actif then 'actif' else 'inactif' end || ')';
  end if;

  insert into journal(user_id, action, entite, entite_id, enfant_id, detail)
  values (auth.uid(), tg_op, tg_table_name, v_id, v_enfant, v_detail);
  return null; -- trigger AFTER : la valeur de retour est ignorée
end
$$;

-- Les documents sont journalisés à l'ajout, au remplacement et à la suppression
drop trigger if exists t_log_d on public.documents;
create trigger t_log_d after insert or update or delete on public.documents
  for each row execute function public.log_change();

-- Les changements de rôle ou d'activation sont aussi journalisés
drop trigger if exists t_log_p on public.profiles;
create trigger t_log_p after update on public.profiles
  for each row execute function public.log_change();

-- Consultations : le site appelle cette fonction quand on ouvre une fiche ou un document.
create or replace function public.noter_consultation(p_entite text, p_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
declare
  v_enfant uuid;
  v_detail text;
begin
  if not public.is_role(array['direction','administrateur']) then
    raise exception 'Accès refusé.';
  end if;
  if p_entite = 'enfants' then
    select id, 'Fiche consultée : ' || matricule into v_enfant, v_detail
    from enfants where id = p_id;
  elsif p_entite = 'documents' then
    select enfant_id, 'Document consulté : ' || titre into v_enfant, v_detail
    from documents where id = p_id;
  else
    raise exception 'Type de consultation inconnu.';
  end if;
  if v_enfant is null then
    raise exception 'Élément introuvable.';
  end if;
  insert into journal(user_id, action, entite, entite_id, enfant_id, detail)
  values (auth.uid(), 'CONSULTATION', p_entite, p_id, v_enfant, v_detail);
end
$$;
revoke execute on function public.noter_consultation(text, uuid) from public, anon;
grant execute on function public.noter_consultation(text, uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 7. STOCKAGE : consultation obligatoirement journalisée
-- ---------------------------------------------------------------------

-- Un fichier ne peut être lu que si :
--   a) la personne a le bon rôle, ET
--   b) elle a noté sa consultation de ce document il y a moins de 2 minutes,
--      OU le fichier n'est plus rattaché à aucun document (fichier remplacé ou
--      supprimé, en cours d'effacement).
-- Résultat : impossible d'ouvrir un document sans laisser de trace dans le journal.
create or replace function public.peut_lire_fichier(p_chemin text) returns boolean
language sql stable security definer set search_path = public as
$$
  select public.is_role(array['direction','administrateur']) and (
    exists (
      select 1 from journal j join documents d on d.id = j.entite_id
      where d.chemin = p_chemin
        and j.user_id = auth.uid()
        and j.action = 'CONSULTATION'
        and j.created_at > now() - interval '2 minutes'
    )
    or not exists (select 1 from documents d where d.chemin = p_chemin)
  )
$$;

drop policy if exists s_sel on storage.objects;
create policy s_sel on storage.objects for select
  using (bucket_id = 'documents' and public.peut_lire_fichier(name));

-- Envoi : uniquement dans le dossier d'un enfant qui existe
drop policy if exists s_ins on storage.objects;
create policy s_ins on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and public.is_role(array['direction','administrateur'])
    and exists (select 1 from public.enfants e where e.id::text = (storage.foldername(name))[1])
  );

-- Effacement d'un fichier (après remplacement ou suppression d'un document)
drop policy if exists s_del on storage.objects;
create policy s_del on storage.objects for delete
  using (bucket_id = 'documents' and public.is_role(array['direction','administrateur']));


-- =====================================================================
-- Vérification (facultatif) : doit afficher les colonnes ajoutées
-- select column_name from information_schema.columns
-- where table_name in ('profiles','enfants','journal') and column_name in
--   ('email','date_sortie','motif_sortie','enfant_id','detail');
-- =====================================================================
