'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const STATI_SAL = ['in_attesa', 'da_emettere', 'fatturato', 'pagato']
const STATI_LABEL: Record<string, string> = {
  in_attesa: 'In attesa', da_emettere: 'Da emettere', fatturato: 'Fatturato', pagato: 'Pagato'
}
const STATI_COLOR: Record<string, { bg: string; color: string }> = {
  in_attesa:   { bg: '#f1f5f9', color: '#475569' },
  da_emettere: { bg: '#fef3c7', color: '#92400e' },
  fatturato:   { bg: '#dbeafe', color: '#1d4ed8' },
  pagato:      { bg: '#dcfce7', color: '#166534' },
}

const STATI_ATT = ['da_fare', 'in_corso', 'completata', 'sospesa']
const STATI_ATT_LABEL: Record<string, string> = {
  da_fare: 'Da fare', in_corso: 'In corso', completata: 'Completata', sospesa: 'Sospesa'
}
const STATI_ATT_COLOR: Record<string, { bg: string; color: string; icon: string }> = {
  da_fare:    { bg: '#f1f5f9', color: '#475569', icon: '○' },
  in_corso:   { bg: '#fef3c7', color: '#92400e', icon: '⟳' },
  completata: { bg: '#dcfce7', color: '#166534', icon: '✓' },
  sospesa:    { bg: '#f1f5f9', color: '#94a3b8', icon: '‖' },
}

export default function DettaglioProgetto() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const [progetto, setProgetto] = useState<any>(null)
  const [sals, setSals] = useState<any[]>([])
  const [documenti, setDocumenti] = useState<any[]>([])
  const [attivita, setAttivita] = useState<{ nome: string; stato: string; nota?: string }[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: p } = await supabase.from('progetti').select('*, clienti(*, portafogli(nome))').eq('id', id).single()
    const { data: s } = await supabase.from('sal').select('*').eq('progetto_id', id).order('numero')
    const { data: d } = await supabase.from('documenti').select('*').eq('progetto_id', id)
    setProgetto(p)
    setSals(s || [])
    setDocumenti(d || [])
    // Costruisci lista attività dai servizi del progetto
    if (p?.servizi?.length) {
      setAttivita(p.servizi.map((nome: string) => ({ nome, stato: 'da_fare', nota: '' })))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function aggiornaSalStato(salId: string, stato: string) {
    await supabase.from('sal').update({ stato }).eq('id', salId)
    setSals(prev => prev.map(s => s.id === salId ? { ...s, stato } : s))
  }

  function aggiornaAttivita(idx: number, stato: string) {
    setAttivita(prev => prev.map((a, i) => i === idx ? { ...a, stato } : a))
  }

  async function eliminaProgetto() {
    if (!confirm('Sei sicuro di voler eliminare questo progetto? L\'operazione è irreversibile.')) return
    await supabase.from('progetti').delete().eq('id', id)
    window.location.href = '/progetti'
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Caricamento...</div>
  if (!progetto) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Progetto non trovato.</div>

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
  const ivaNum = parseFloat(progetto.iva_percentuale) || 22
  const cassaNum = parseFloat(progetto.cassa_percentuale) || 0
  const importoCassa = progetto.importo_netto * cassaNum / 100
  const imponibile = progetto.importo_netto + importoCassa
  const iva = imponibile * ivaNum / 100
  const totLordo = imponibile + iva
  const salCompletati = sals.filter(s => ['fatturato', 'pagato'].includes(s.stato)).length
  const percAvanz = sals.length > 0 ? (salCompletati / sals.length * 100) : 0
  const attCompletate = attivita.filter(a => a.stato === 'completata').length
  const percAtt = attivita.length > 0 ? (attCompletate / attivita.length * 100) : 0

  const nomeCliente = progetto.clienti?.ragione_sociale ||
    `${progetto.clienti?.nome || ''} ${progetto.clienti?.cognome || ''}`.trim() ||
    'Cliente'

  return (
    <>
      <Topbar
        title={nomeCliente}
        subtitle={`${progetto.numero_ordine} · ${progetto.tipo_servizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura e Posa'}`}
      />
      <div style={{ padding: '20px 24px' }}>

        {/* HEADER CARD */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', background: '#dbeafe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, color: '#1d4ed8', flexShrink: 0
            }}>
              {nomeCliente.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{nomeCliente}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {progetto.clienti?.portafogli?.nome} · {progetto.numero_ordine}
                {progetto.numero_offerta && ` · Off. ${progetto.numero_offerta}`}
                {' · '}
                <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20 }}>
                  {progetto.tipo_servizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura/Posa'}
                </span>
              </div>
              {progetto.servizi?.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {progetto.servizi.map((s: string) => (
                    <span key={s} style={{ fontSize: 10, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 20 }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/ordine/modifica/${id}`} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 11, textDecoration: 'none' }}>✏ Modifica</Link>
              <button onClick={eliminaProgetto} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', fontSize: 11, cursor: 'pointer' }}>🗑</button>
            </div>
          </div>

          {/* Importi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { label: 'Importo netto',              value: fmt(progetto.importo_netto) },
              { label: `Cassa ingegneri (${cassaNum}%)`, value: fmt(importoCassa) },
              { label: `IVA ${ivaNum}%`,             value: fmt(iva) },
              { label: 'Totale lordo',               value: fmt(totLordo), highlight: true },
            ].map(s => (
              <div key={s.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.highlight ? '#3b82f6' : '#0f172a' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* DATI ORDINE */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', borderLeft: '3px solid #6ab04c', padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            Dati ordine
            <span style={{ fontSize: 9, fontWeight: 700, color: '#6ab04c', background: '#f0fdf4', border: '1px solid #6ab04c50', borderRadius: 20, padding: '1px 7px' }}>Nuovo</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'N° ordine',     value: progetto.numero_ordine, mono: true },
              { label: 'N° offerta',    value: progetto.numero_offerta || '—', mono: true },
              { label: 'Data creazione',value: new Date(progetto.created_at).toLocaleDateString('it-IT') },
              { label: 'Tipo servizio', value: progetto.tipo_servizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura/Posa' },
              { label: 'Portafoglio',   value: progetto.clienti?.portafogli?.nome || '—' },
              { label: 'Stato',         value: progetto.stato || '—' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>{f.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, fontFamily: f.mono ? 'monospace' : undefined }}>{f.value}</div>
              </div>
            ))}
          </div>
          {progetto.note && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 11, color: '#64748b' }}>
              <strong>Note:</strong> {progetto.note}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ATTIVITÀ DI INGEGNERIA */}
            {attivita.length > 0 && (
              <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', borderLeft: '3px solid #6ab04c', padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Attività di ingegneria
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#6ab04c', background: '#f0fdf4', border: '1px solid #6ab04c50', borderRadius: 20, padding: '1px 7px' }}>Nuovo</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{attCompletate}/{attivita.length} completate</div>
                </div>
                {/* Barra avanzamento */}
                <div style={{ height: 5, background: '#f1f5f9', borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${percAtt}%`, background: '#6ab04c', borderRadius: 10, transition: 'width .4s' }} />
                </div>
                {attivita.map((att, idx) => {
                  const s = STATI_ATT_COLOR[att.stato]
                  return (
                    <div key={att.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: idx < attivita.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                        {s.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{att.nome}</div>
                        {att.nota && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{att.nota}</div>}
                      </div>
                      <select
                        value={att.stato}
                        onChange={e => aggiornaAttivita(idx, e.target.value)}
                        style={{
                          fontSize: 10, padding: '3px 7px', borderRadius: 20, border: 'none',
                          fontWeight: 600, cursor: 'pointer',
                          background: s.bg, color: s.color
                        }}
                      >
                        {STATI_ATT.map(st => <option key={st} value={st}>{STATI_ATT_LABEL[st]}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}

            {/* SAL */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Piano di fatturazione (SAL)</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{salCompletati}/{sals.length} completati</div>
              </div>
              <div style={{ height: 6, background: '#f1f5f9', borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${percAvanz}%`, background: '#3b82f6', borderRadius: 10, transition: 'width .5s' }} />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {['#', 'Descrizione', 'Data', 'Importo', 'Stato'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', textAlign: 'left', fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sals.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Nessun SAL configurato</td></tr>
                  )}
                  {sals.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #fafafa' }}>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>SAL {s.numero}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 500 }}>{s.descrizione}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b', fontSize: 11 }}>
                        {s.data_prevista ? new Date(s.data_prevista).toLocaleDateString('it-IT') : '—'}
                      </td>
                      <td style={{ padding: '8px 6px', fontWeight: 700 }}>{fmt(s.importo)}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <select
                          value={s.stato}
                          onChange={e => aggiornaSalStato(s.id, e.target.value)}
                          style={{
                            fontSize: 10, padding: '3px 7px', borderRadius: 20, border: 'none',
                            fontWeight: 600, cursor: 'pointer',
                            background: STATI_COLOR[s.stato]?.bg || '#f1f5f9',
                            color: STATI_COLOR[s.stato]?.color || '#475569'
                          }}
                        >
                          {STATI_SAL.map(st => <option key={st} value={st}>{STATI_LABEL[st]}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* COLONNA DESTRA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Documenti */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Documenti allegati</div>
              {documenti.length === 0 && <div style={{ fontSize: 11, color: '#94a3b8' }}>Nessun documento allegato</div>}
              {documenti.map(d => (
                <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                  background: '#f8fafc', border: '1px solid #e5e5e2', borderRadius: 7,
                  marginBottom: 5, textDecoration: 'none', color: '#334155'
                }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{d.nome}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{d.tipo}{d.dimensione ? ` · ${Math.round(d.dimensione / 1024)} KB` : ''}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#3b82f6' }}>↓</span>
                </a>
              ))}
            </div>

            {/* Dati cliente */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Dati cliente</div>
              {[
                ['Email',     progetto.clienti?.email],
                ['Telefono',  progetto.clienti?.telefono],
                ['PEC',       progetto.clienti?.pec],
                ['P.IVA',     progetto.clienti?.piva],
                ['CF',        progetto.clienti?.cf],
                ['SDI',       progetto.clienti?.sdi],
                ['Referente', progetto.clienti?.referente],
                ['Indirizzo', progetto.clienti?.indirizzo],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #fafafa', fontSize: 12 }}>
                  <span style={{ color: '#94a3b8' }}>{label}</span>
                  <span style={{ color: '#334155', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Link href="/ordini" style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, textDecoration: 'none' }}>← Tutti gli ordini</Link>
          <Link href="/progetti" style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, textDecoration: 'none' }}>← Tutti i progetti</Link>
        </div>
      </div>
    </>
  )
}
