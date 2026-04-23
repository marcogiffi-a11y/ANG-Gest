-- ================================================
-- SCHEMA GESTIONALE CANTIERI — Athena Next Gen
-- Esegui questo SQL in: Supabase → SQL Editor → New query
-- ================================================

-- Portafogli
create table portafogli (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  created_at timestamptz default now()
);

-- Clienti
create table clienti (
  id uuid default gen_random_uuid() primary key,
  portafoglio_id uuid references portafogli(id) on delete set null,
  ragione_sociale text not null,
  piva text,
  referente text,
  email text,
  telefono text,
  pec text,
  indirizzo text,
  created_at timestamptz default now()
);

-- Progetti (Ordini)
create table progetti (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references clienti(id) on delete cascade,
  numero_ordine text not null,
  numero_offerta text,
  tipo_servizio text not null check (tipo_servizio in ('ingegneria', 'fornitura_posa')),
  servizi text[] default '{}',
  importo_netto numeric(12,2) not null default 0,
  cassa_percentuale numeric(5,2) default 4,
  iva_percentuale numeric(5,2) default 22,
  note text,
  stato text default 'attivo' check (stato in ('bozza','attivo','completato','sospeso')),
  created_at timestamptz default now()
);

-- SAL (Stati Avanzamento Lavori)
create table sal (
  id uuid default gen_random_uuid() primary key,
  progetto_id uuid references progetti(id) on delete cascade,
  numero int not null,
  descrizione text not null,
  percentuale numeric(5,2) not null,
  importo numeric(12,2) not null,
  data_prevista date,
  stato text default 'in_attesa' check (stato in ('in_attesa','da_emettere','fatturato','pagato')),
  created_at timestamptz default now()
);

-- Documenti
create table documenti (
  id uuid default gen_random_uuid() primary key,
  progetto_id uuid references progetti(id) on delete cascade,
  nome text not null,
  tipo text,
  url text not null,
  dimensione int,
  created_at timestamptz default now()
);

-- Servizi di Ingegneria (Legenda)
create table servizi_ingegneria (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  ordine int default 0,
  created_at timestamptz default now()
);

-- Dati predefiniti legenda servizi
insert into servizi_ingegneria (nome, ordine) values
  ('Progettazione preliminare', 1),
  ('Progettazione definitiva', 2),
  ('Progettazione esecutiva', 3),
  ('Direzione lavori', 4),
  ('Coordinamento sicurezza in fase di progettazione', 5),
  ('Coordinamento sicurezza in fase di esecuzione', 6),
  ('Collaudo statico', 7),
  ('Perizia estimativa', 8),
  ('Pratiche catastali', 9),
  ('Autorizzazioni / SUAP', 10),
  ('Studio di fattibilità', 11);

-- Portafogli predefiniti
insert into portafogli (nome) values
  ('Comuni Veneto'),
  ('Privati');

-- RLS (Row Level Security) — tutti gli utenti autenticati leggono/scrivono
alter table portafogli enable row level security;
alter table clienti enable row level security;
alter table progetti enable row level security;
alter table sal enable row level security;
alter table documenti enable row level security;
alter table servizi_ingegneria enable row level security;

create policy "Autenticati possono tutto" on portafogli for all using (auth.role() = 'authenticated');
create policy "Autenticati possono tutto" on clienti for all using (auth.role() = 'authenticated');
create policy "Autenticati possono tutto" on progetti for all using (auth.role() = 'authenticated');
create policy "Autenticati possono tutto" on sal for all using (auth.role() = 'authenticated');
create policy "Autenticati possono tutto" on documenti for all using (auth.role() = 'authenticated');
create policy "Autenticati possono tutto" on servizi_ingegneria for all using (auth.role() = 'authenticated');

-- Storage bucket per PDF
insert into storage.buckets (id, name, public) values ('documenti', 'documenti', false);
create policy "Autenticati upload" on storage.objects for insert with check (auth.role() = 'authenticated');
create policy "Autenticati lettura" on storage.objects for select using (auth.role() = 'authenticated');
create policy "Autenticati delete" on storage.objects for delete using (auth.role() = 'authenticated');
