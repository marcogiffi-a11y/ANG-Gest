# ANG Gest — Athena Next Gen S.r.l.

Gestionale per la gestione di progetti, ordini, SAL e fatturazione.

---

## 🚀 Deploy su Vercel (Drag & Drop)

### PASSO 1 — Configura Supabase

1. Vai su [supabase.com](https://supabase.com) e crea un progetto
2. Vai su **SQL Editor** → **New query**
3. Copia e incolla il contenuto di `supabase/schema.sql`
4. Clicca **Run** per creare tutte le tabelle

5. Vai su **Authentication** → **Providers** → abilita **Google** (opzionale)

6. Vai su **Project Settings** → **API** e copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### PASSO 2 — Deploy su Vercel

1. Vai su [vercel.com](https://vercel.com) e accedi
2. Clicca **Add New Project**
3. Seleziona **"Import Third-Party Git Repository"** oppure trascina questa cartella
4. Nella sezione **Environment Variables** aggiungi:

```
NEXT_PUBLIC_SUPABASE_URL      = https://XXXXXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsIn...
ANTHROPIC_API_KEY             = sk-ant-... (opzionale, per la funzione IA)
```

5. Clicca **Deploy** — il sito sarà online in 2 minuti!

---

## 🤖 Funzione IA (lettura PDF)

La funzione IA che legge i contratti PDF ed estrae automaticamente i SAL richiede una chiave API di Anthropic:

1. Vai su [console.anthropic.com](https://console.anthropic.com)
2. Crea un account e aggiungi un piccolo credito (5€ bastano per mesi)
3. Vai su **API Keys** → crea una chiave
4. Aggiungila come variabile d'ambiente `ANTHROPIC_API_KEY` su Vercel

Senza questa chiave il gestionale funziona al 100%, ma i SAL vanno inseriti manualmente.

---

## 📁 Struttura progetto

```
app/
  (gestionale)/        → Pagine con sidebar (protette da login)
    dashboard/         → Dashboard principale
    progetti/          → Lista e dettaglio progetti
    fatture/           → Piano fatturazione SAL
    scadenze/          → Calendario scadenze
    ordine/nuovo/      → Wizard creazione ordine (3 step + IA)
    clienti/           → Anagrafica clienti
    portafogli/        → Gestione portafogli
    documenti/         → Archivio PDF
    legenda/           → Configurazione servizi
    utenti/            → Gestione accessi
    impostazioni/      → Configurazione generale
  login/               → Pagina di accesso
  api/
    analizza-pdf/      → API endpoint per IA lettura PDF
    auth/callback/     → Callback OAuth Google
components/
  Sidebar.tsx          → Navigazione laterale
  Topbar.tsx           → Barra superiore
lib/
  supabase/            → Client Supabase
  types.ts             → Tipi TypeScript
supabase/
  schema.sql           → Schema database (esegui su Supabase)
```

---

## 🛠 Sviluppo locale

```bash
# 1. Installa dipendenze
npm install

# 2. Copia le variabili d'ambiente
cp .env.local.example .env.local
# Poi compila .env.local con i tuoi valori Supabase

# 3. Avvia il server di sviluppo
npm run dev

# Apri http://localhost:3000
```
