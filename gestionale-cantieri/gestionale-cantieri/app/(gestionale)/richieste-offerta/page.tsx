'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Topbar from '@/components/Topbar'

// Client separato per athena-cantieri (database della PWA ANG DL)
const supabasePWA = createClient(
  'https://bfcfgxpkwmlhvjhegmxv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmY2ZneHBrd21saHZqaGVnbXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTM5NzIsImV4cCI6MjA5Mjg2OTk3Mn0.PbwbpCklqiZv_rrsCjATxc56rNCNy_s-cXSideAMY0Y'
)

// ─── Tipi ────────────────────────────────────────────────────────────────────

type StatoRichiesta = 'nuova' | 'vista' | 'in_lavorazione' | 'convertita'

type RichiestaOfferta = {
  id: string
  cliente: string
  potenza_kw: number | null
  accumulo_kwh: number | null
  maps_link: string | null
  indirizzo: string | null
  impianto_esistente: boolean
  potenza_esistente_kw: number | null
  contatore_prelievo_kw: number | null
  stato: StatoRichiesta
  created_at: string
  _docCount?: number
}

// ─── Configurazione stati ─────────────────────────────────────────────────────

const STATO_CFG: Record<StatoRichiesta, { bg: string; color: string; label: string; dot?: string }> = {
  nuova:         { bg: '#dbeafe', color: '#1d4ed8', label: '🔵 Nuova',          dot: '#3b82f6' },
  vista:         { bg: '#fef3c7', color: '#92400e', label: '👁 Vista',           dot: '#f59e0b' },
  in_lavorazione:{ bg: '#ede9fe', color: '#6d28d9', label: '⚙️ In lavorazione',  dot: '#8b5cf6' },
  convertita:    { bg: '#dcfce7', color: '#166534', label: '✓ Convertita',       dot: '#22c55e' },
}

const STATI_ORDINE: StatoRichiesta[] = ['nuova', 'vista', 'in_lavorazione', 'convertita']

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtData = (d: string) =>
  d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// ─── Drawer dettaglio ─────────────────────────────────────────────────────────

function Drawer({ richiesta, onClose, onStatoChange }: {
  richiesta: RichiestaOfferta
  onClose: () => void
  onStatoChange: (id: string, stato: StatoRichiesta) => void
}) {
  const [docs, setDocs] = useState<any[]>([])
  useEffect(() => {
    supabasePWA
      .from('documenti_cantiere')
      .select('*')
      .eq('richiesta_id', richiesta.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setDocs(data || []))
  }, [richiesta.id])

  const stato = STATO_CFG[richiesta.stato] ?? STATO_CFG.nuova

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 100, animation: 'fadeInOverlay .2s ease'
        }}
      />

      {/* Pannello laterale */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: 'white', zIndex: 101, boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto'
      }}>
        {/* Header drawer */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
              {richiesta.cliente}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Ricevuta il {fmtData(richiesta.created_at)}</div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 14, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>

        <div style={{ padding: '20px 24px', flex: 1 }}>

          {/* Stato */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8', marginBottom: 8 }}>Stato richiesta</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATI_ORDINE.map(s => {
                const cfg = STATO_CFG[s]
                const attivo = richiesta.stato === s
                return (
                  <button
                    key={s}
                    onClick={() => onStatoChange(richiesta.id, s)}
                    style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: attivo ? `2px solid ${cfg.dot}` : '1px solid #e2e8f0',
                      background: attivo ? cfg.bg : 'white',
                      color: attivo ? cfg.color : '#94a3b8',
                      transition: 'all .15s'
                    }}
                  >{cfg.label}</button>
                )
              })}
            </div>
          </div>

          {/* Dati impianto */}
          <Section title="Dati impianto">
            <Row label="Potenza"           value={richiesta.potenza_kw        ? `${richiesta.potenza_kw} kW`   : '—'} />
            <Row label="Accumulo"          value={richiesta.accumulo_kwh      ? `${richiesta.accumulo_kwh} kWh` : '—'} />
            <Row label="Contatore prelievo" value={richiesta.contatore_prelievo_kw ? `${richiesta.contatore_prelievo_kw} kW` : '—'} />
          </Section>

          {/* Impianto esistente */}
          <Section title="Impianto esistente">
            <Row label="Presente" value={richiesta.impianto_esistente ? '✅ Sì' : '❌ No'} />
            {richiesta.impianto_esistente && richiesta.potenza_esistente_kw && (
              <Row label="Potenza esistente" value={`${richiesta.potenza_esistente_kw} kW`} />
            )}
          </Section>

          {/* Posizione */}
          {(richiesta.maps_link || richiesta.indirizzo) && (
            <Section title="Posizione">
              {richiesta.indirizzo && <Row label="Indirizzo" value={richiesta.indirizzo} />}
              {richiesta.maps_link && (
                <a
                  href={richiesta.maps_link}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 0',
                    padding: '10px 12px', borderRadius: 8,
                    background: '#f0fdf4', border: '1px solid #bbf7d0', textDecoration: 'none'
                  }}
                >
                  <span style={{ fontSize: 18 }}>📍</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>Apri su Google Maps</div>
                    <div style={{ fontSize: 10, color: '#4ade80' }}>Tocca per aprire</div>
                  </div>
                </a>
              )}
            </Section>
          )}

          {/* Materiale sopralluogo */}
          <Section title={`Materiale sopralluogo (${docs.length} file)`}>
            {docs.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>Nessun file caricato</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {docs.map(doc => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 7, border: '1px solid #f1f5f9',
                      background: '#fafafa', textDecoration: 'none'
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{docIcon(doc.tipo)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.nome}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{doc.tipo?.toUpperCase()} · {fmtData(doc.created_at)}</div>
                    </div>
                    <span style={{ fontSize: 13, color: '#3b82f6' }}>↗</span>
                  </a>
                ))}
              </div>
            )}
          </Section>

        </div>

        {/* Footer azioni */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
          <button
            onClick={() => onStatoChange(richiesta.id, 'in_lavorazione')}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
              background: '#1d3a6b', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer'
            }}
          >
            ⚙️ Prendi in carico
          </button>
          <button
            onClick={() => onStatoChange(richiesta.id, 'convertita')}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
              background: '#6ab826', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer'
            }}
          >
            ✓ Segna convertita
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Componenti helper ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8', marginBottom: 8 }}>{title}</div>
      <div style={{ background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{value}</span>
    </div>
  )
}

function docIcon(tipo: string) {
  if (tipo === 'foto') return '📷'
  if (tipo === 'scan_pdf') return '📑'
  if (tipo === 'pdf') return '📄'
  return '📎'
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function RichiesteOffertaPage() {
  // supabase non usato qui

  const [richieste,    setRichieste]    = useState<RichiestaOfferta[]>([])
  const [loading,      setLoading]      = useState(true)
  const [cerca,        setCerca]        = useState('')
  const [filtroStato,  setFiltroStato]  = useState<StatoRichiesta | ''>('')
  const [selezionata,  setSelezionata]  = useState<RichiestaOfferta | null>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabasePWA
      .from('richieste_offerta')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      // Carica conteggio documenti per ogni richiesta
      const ids = data.map((r: any) => r.id)
      const { data: docData } = await supabasePWA
        .from('documenti_cantiere')
        .select('richiesta_id')
        .in('richiesta_id', ids)

      const docMap: Record<string, number> = {}
      docData?.forEach((d: any) => {
        docMap[d.richiesta_id] = (docMap[d.richiesta_id] || 0) + 1
      })

      setRichieste(data.map((r: any) => ({ ...r, _docCount: docMap[r.id] || 0 })))
    }
    setLoading(false)
  }

  async function aggiornaStato(id: string, stato: StatoRichiesta) {
    await supabasePWA.from('richieste_offerta').update({ stato }).eq('id', id)
    setRichieste(prev => prev.map(r => r.id === id ? { ...r, stato } : r))
    if (selezionata?.id === id) setSelezionata(prev => prev ? { ...prev, stato } : prev)
  }

  const filtrate = richieste.filter(r => {
    const q = cerca.toLowerCase()
    const matchSearch = !q || r.cliente?.toLowerCase().includes(q) || r.indirizzo?.toLowerCase().includes(q)
    const matchStato  = !filtroStato || r.stato === filtroStato
    return matchSearch && matchStato
  })

  // Contatori per i badge filtro
  const counts: Record<string, number> = {}
  richieste.forEach(r => { counts[r.stato] = (counts[r.stato] || 0) + 1 })
  const nuoveCount = counts['nuova'] || 0

  return (
    <>
      <Topbar
        title="Richieste di Offerta"
        subtitle={nuoveCount > 0 ? `${nuoveCount} nuova${nuoveCount > 1 ? 'e' : ''} dal campo` : 'Tutte le richieste dal campo'}
      />

      <div style={{ padding: '20px 24px' }}>

        {/* Barra filtri */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={cerca}
            onChange={e => setCerca(e.target.value)}
            placeholder="🔍  Cerca cliente, indirizzo..."
            style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12 }}
          />

          {/* Filtri stato con contatori */}
          <div style={{ display: 'flex', gap: 6 }}>
            <FiltroBtn label="Tutte" count={richieste.length} active={filtroStato === ''} onClick={() => setFiltroStato('')} color="#64748b" />
            {STATI_ORDINE.map(s => (
              <FiltroBtn
                key={s}
                label={STATO_CFG[s].label}
                count={counts[s] || 0}
                active={filtroStato === s}
                onClick={() => setFiltroStato(s === filtroStato ? '' : s)}
                color={STATO_CFG[s].dot!}
              />
            ))}
          </div>
        </div>

        {/* Tabella */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 13 }}>Caricamento...</div>
          ) : filtrate.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 13 }}>
              {richieste.length === 0
                ? 'Nessuna richiesta ricevuta — le richieste inviate dall\'app ANG DL appariranno qui 📲'
                : 'Nessuna richiesta corrisponde ai filtri'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Cliente', 'Impianto', 'Accumulo', 'Indirizzo', 'Materiale', 'Data', 'Stato'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrate.map(r => {
                  const cfg = STATO_CFG[r.stato] ?? STATO_CFG.nuova
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelezionata(r)}
                      style={{ borderBottom: '1px solid #fafafa', cursor: 'pointer', transition: 'background .1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                    >
                      {/* Cliente */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.cliente || '—'}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>ID: {r.id.slice(0, 8)}…</div>
                      </td>

                      {/* kW */}
                      <td style={{ padding: '12px 14px', color: '#334155' }}>
                        {r.potenza_kw ? <span style={{ fontWeight: 600 }}>{r.potenza_kw} kW</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>

                      {/* kWh */}
                      <td style={{ padding: '12px 14px', color: '#334155' }}>
                        {r.accumulo_kwh ? <span>{r.accumulo_kwh} kWh</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>

                      {/* Indirizzo */}
                      <td style={{ padding: '12px 14px', maxWidth: 180 }}>
                        {r.maps_link ? (
                          <a href={r.maps_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            style={{ color: '#16a34a', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                            📍 Maps
                          </a>
                        ) : r.indirizzo ? (
                          <span style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 160 }}>
                            {r.indirizzo}
                          </span>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>

                      {/* Materiale */}
                      <td style={{ padding: '12px 14px' }}>
                        {(r._docCount ?? 0) > 0 ? (
                          <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                            📎 {r._docCount} file
                          </span>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: 11 }}>nessuno</span>
                        )}
                      </td>

                      {/* Data */}
                      <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 11 }}>
                        {fmtData(r.created_at)}
                      </td>

                      {/* Stato */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer contatore */}
        {!loading && filtrate.length > 0 && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, textAlign: 'right' }}>
            {filtrate.length} di {richieste.length} richieste
          </div>
        )}
      </div>

      {/* Drawer dettaglio */}
      {selezionata && (
        <Drawer
          richiesta={selezionata}
          onClose={() => setSelezionata(null)}
          onStatoChange={aggiornaStato}
        />
      )}

      <style>{`
        @keyframes fadeInOverlay { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </>
  )
}

// ─── Bottone filtro ───────────────────────────────────────────────────────────

function FiltroBtn({ label, count, active, onClick, color }: {
  label: string; count: number; active: boolean; onClick: () => void; color: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
        border: active ? `2px solid ${color}` : '1px solid #e2e8f0',
        background: active ? `${color}18` : 'white',
        color: active ? color : '#64748b',
        transition: 'all .15s'
      }}
    >
      {label}
      <span style={{
        background: active ? color : '#e2e8f0',
        color: active ? 'white' : '#64748b',
        borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 700
      }}>{count}</span>
    </button>
  )
}
