-- ORPHELINAT EMMANUEL : à exécuter UNE SEULE FOIS (Supabase > SQL Editor > New query > Run)

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom_complet text not null default '',
  role text not null default 'administrateur' check (role in ('direction','administrateur','technique')),
  actif boolean not null default false  -- un nouveau compte n'a AUCUN accès tant qu'il n'est pas activé
);
create table public.enfants (
  id uuid primary key default gen_random_uuid(),
  matricule text not null unique,
  nom text not null, prenoms text not null,
  sexe text not null default 'Non renseigné' check (sexe in ('Masculin','Féminin','Non renseigné')),
  date_naissance date, lieu_naissance text, date_admission date,
  provenance text, motif_admission text, remarques text,
  statut text not null default 'Actif' check (statut in ('Actif','Sorti','Archivé')),
  created_by uuid default auth.uid(), created_at timestamptz default now(),
  updated_by uuid, updated_at timestamptz
);
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  enfant_id uuid not null references public.enfants(id) on delete cascade,
  titre text not null, type text, chemin text not null, mime text, taille int,
  created_by uuid default auth.uid(), created_at timestamptz default now()
);
create table public.journal (
  id bigserial primary key, user_id uuid, action text, entite text, entite_id uuid,
  created_at timestamptz default now()
);

-- Qui a le droit ? (direction + administrateur voient les dossiers ; technique non)
create function public.is_role(r text[]) returns boolean
language sql security definer stable set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and actif and role = any(r)) $$;

-- Profil créé automatiquement (inactif) à la création d'un compte
create function public.new_user() returns trigger
language plpgsql security definer set search_path = public as
$$ begin insert into profiles(id) values (new.id); return new; end $$;
create trigger on_auth_user after insert on auth.users for each row execute function public.new_user();

-- Qui a modifié et quand ; journal d'activité infalsifiable (écrit par la base, pas par le site)
create function public.touch() returns trigger language plpgsql as
$$ begin new.updated_by = auth.uid(); new.updated_at = now(); return new; end $$;
create trigger t_touch before update on public.enfants for each row execute function public.touch();
create function public.log_change() returns trigger
language plpgsql security definer set search_path = public as
$$ begin insert into journal(user_id, action, entite, entite_id) values (auth.uid(), tg_op, tg_table_name, new.id); return new; end $$;
create trigger t_log_e after insert or update on public.enfants for each row execute function public.log_change();
create trigger t_log_d after insert on public.documents for each row execute function public.log_change();

-- Sécurité (RLS) : sans policy, personne ne lit rien. Pas de suppression d'enfant : on archive.
alter table public.profiles  enable row level security;
alter table public.enfants   enable row level security;
alter table public.documents enable row level security;
alter table public.journal   enable row level security;

create policy p_sel on public.profiles  for select using (id = auth.uid() or public.is_role(array['direction']));
create policy p_upd on public.profiles  for update using (public.is_role(array['direction']));
create policy e_sel on public.enfants   for select using (public.is_role(array['direction','administrateur']));
create policy e_ins on public.enfants   for insert with check (public.is_role(array['direction','administrateur']));
create policy e_upd on public.enfants   for update using (public.is_role(array['direction','administrateur']));
create policy d_sel on public.documents for select using (public.is_role(array['direction','administrateur']));
create policy d_ins on public.documents for insert with check (public.is_role(array['direction','administrateur']));
create policy j_sel on public.journal   for select using (public.is_role(array['direction']));

-- Documents : bucket PRIVÉ, 10 Mo max, PDF/JPG/PNG uniquement
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf','image/jpeg','image/png']);
create policy s_sel on storage.objects for select
  using (bucket_id = 'documents' and public.is_role(array['direction','administrateur']));
create policy s_ins on storage.objects for insert
  with check (bucket_id = 'documents' and public.is_role(array['direction','administrateur']));
