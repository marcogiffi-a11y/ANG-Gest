'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { Cliente, StatoPreventivo, TipoServizio, TipoCliente } from '@/lib/types'

const IVA_OPTIONS = [
  { label: '22% — standard',        value: 22 },
  { label: '10% — fondi agricoli',   value: 10 },
  { label: '4% — agevolata',         value: 4  },
  { label: 'Esente art. 10',         value: 0  },
  { label: 'Fuori campo IVA',        value: 0  },
  { label: 'Reverse charge art. 17', value: 0  },
]

const STATI: Record<StatoPreventivo, { bg: string; color: string; label: string }> = {
  bozza:     { bg: '#f1f5f9', color: '#475569', label: 'Bozza' },
  inviato:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Inviato' },
  in_attesa: { bg: '#fef3c7', color: '#92400e', label: 'In attesa' },
  accettato: { bg: '#dcfce7', color: '#166534', label: 'Accettato' },
  rifiutato: { bg: '#fee2e2', color: '#991b1b', label: 'Rifiutato' },
  scaduto:   { bg: '#f1f5f9', color: '#94a3b8', label: 'Scaduto' },
}

const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, color: '#0f172a', background: 'white' }

type Voce = { id?: string; sezione: string; descrizione: string; importo: number }
type Tranche = { id?: string; descrizione: string; percentuale: number; ordine: number }

export default function DettaglioPreventivo() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // dati preventivo
  const [numeroOfferta, setNumeroOfferta] = useState('')
  const [dataEmissione, setDataEmissione] = useState('')
  const [validitaGiorni, setValiditaGiorni] = useState(20)
  const [stato, setStato] = useState<StatoPreventivo>('bozza')
  const [tipoServizio, setTipoServizio] = useState<TipoServizio>('ingegneria')
  const [tipoCliente, setTipoCliente] = useState<TipoCliente>('ente')
  const [oggetto, setOggetto] = useState('')
  const [note, setNote] = useState('')
  const [ivaPerc, setIvaPerc] = useState(22)
  const [ivaLabel, setIvaLabel] = useState('22% — standard')

  // cliente
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [clienteSelezionato, setClienteSelezionato] = useState<Cliente | null>(null)
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [ddAperto, setDdAperto] = useState(false)

  // voci e tranche
  const [voci, setVoci] = useState<Voce[]>([])
  const [tranche, setTranche] = useState<Tranche[]>([])

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase
        .from('preventivi')
        .select('*, clienti(*, portafogli(nome)), preventivo_voci(*), preventivo_tranche(*)')
        .eq('id', id)
        .single()

      if (!p) { router.push('/preventivi'); return }

      setNumeroOfferta(p.numero_offerta || '')
      setDataEmissione(p.data_emissione || '')
      setValiditaGiorni(p.validita_giorni || 20)
      setStato(p.stato as StatoPreventivo)
      setTipoServizio(p.tipo_servizio as TipoServizio)
      setTipoCliente(p.tipo_cliente as TipoCliente)
      setOggetto(p.oggetto || '')
      setNote(p.note || '')
      if (p.iva_percentuale) {
        setIvaPerc(p.iva_percentuale)
        const opt = IVA_OPTIONS.find(o => o.value === p.iva_percentuale)
        if (opt) setIvaLabel(opt.label)
      }
      if (p.clienti) setClienteSelezionato(p.clienti as Cliente)

      const vociOrdinate = [...(p.preventivo_voci || [])].sort((a: any, b: any) => a.ordine - b.ordine)
      setVoci(vociOrdinate.map((v: any) => ({ id: v.id, sezione: v.sezione, descrizione: v.descrizione, importo: v.importo })))

      const trancheOrdinate = [...(p.preventivo_tranche || [])].sort((a: any, b: any) => a.ordine - b.ordine)
      setTranche(trancheOrdinate.map((t: any) => ({ id: t.id, descrizione: t.descrizione, percentuale: t.percentuale, ordine: t.ordine })))

      setLoading(false)
    }

    supabase.from('clienti').select('*, portafogli(nome)').order('ragione_sociale').then(({ data }) => {
      setClienti((data as Cliente[]) || [])
    })
    load()
  }, [id])

  const totaleImponibile = voci.reduce((acc, v) => acc + (v.importo || 0), 0)
  const ivaImporto = totaleImponibile * ivaPerc / 100
  const totaleLordo = totaleImponibile + ivaImporto
  const percTot = tranche.reduce((acc, t) => acc + t.percentuale, 0)

  function updateVoce(idx: number, field: 'descrizione' | 'importo', val: string | number) {
    setVoci(prev => prev.map((v, i) => i === idx ? { ...v, [field]: val } : v))
  }
  function deleteVoce(idx: number) {
    setVoci(prev => prev.filter((_, i) => i !== idx))
  }
  function addVoce(sezione: string) {
    setVoci(prev => [...prev, { sezione, descrizione: '', importo: 0 }])
  }
  function updateTranche(idx: number, field: 'descrizione' | 'percentuale', val: string | number) {
    setTranche(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t))
  }

  function esportaWord() {
    window.open(`/api/preventivo-export/${id}`, '_blank')
  }

  function esportaPDF() {
    const win = window.open(`/api/preventivo-export/${id}`, '_blank')
    if (win) win.focus()
  }

  async function salvaModifiche() {
    setSaving(true)
    try {
      // Aggiorna preventivo
      await supabase.from('preventivi').update({
        numero_offerta:  numeroOfferta,
        data_emissione:  dataEmissione,
        validita_giorni: validitaGiorni,
        stato,
        cliente_id:      clienteSelezionato?.id || null,
        oggetto:         oggetto || null,
        tipo_servizio:   tipoServizio,
        tipo_cliente:    tipoCliente,
        iva_percentuale: tipoCliente === 'privato' ? ivaPerc : null,
        note:            note || null,
      }).eq('id', id)

      // Riscrive voci: elimina tutte e reinserisce
      await supabase.from('preventivo_voci').delete().eq('preventivo_id', id)
      const vociDaInserire = voci
        .filter(v => v.descrizione.trim())
        .map((v, i) => ({ preventivo_id: id, sezione: v.sezione, descrizione: v.descrizione, importo: v.importo, ordine: i }))
      if (vociDaInserire.length > 0) {
        await supabase.from('preventivo_voci').insert(vociDaInserire)
      }

      // Riscrive tranche
      await supabase.from('preventivo_tranche').delete().eq('preventivo_id', id)
      const trancheDaInserire = tranche.map((t, i) => ({
        preventivo_id: id, descrizione: t.descrizione, percentuale: t.percentuale, ordine: i
      }))
      await supabase.from('preventivo_tranche').insert(trancheDaInserire)

      router.push('/preventivi')
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  async function eliminaPreventivo() {
    if (!confirm('Eliminare questo preventivo? L\'operazione è irreversibile.')) return
    await supabase.from('preventivi').delete().eq('id', id)
    router.push('/preventivi')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Caricamento...</div>

  const statoStyle = STATI[stato] || STATI.bozza
  const clientiFiltrati = clienti.filter(c =>
    !clienteFiltro || c.ragione_sociale.toLowerCase().includes(clienteFiltro.toLowerCase()) || c.piva?.includes(clienteFiltro)
  )
  const sezioniUniche = [...new Set(voci.map(v => v.sezione))]

  return (
    <>
      <Topbar
        title={numeroOfferta}
        subtitle={`${tipoServizio === 'ingegneria' ? 'Ingegneria' : 'Fornitura/Posa'} · ${tipoCliente === 'privato' ? 'Privato' : tipoCliente === 'ente' ? 'Ente pubblico' : 'Altro soggetto'} · ${clienteSelezionato?.ragione_sociale || '—'}`}
      />
      <div style={{ padding: '20px 24px', maxWidth: 860, margin: '0 auto' }}>

        {/* Banner modifica */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
          ✏️ Modalità modifica — tutti i campi sono editabili. Premi "Salva modifiche" per confermare.
        </div>

        {/* Intestazione */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Intestazione offerta</div>
            <button onClick={eliminaPreventivo} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', fontSize: 11, cursor: 'pointer' }}>🗑 Elimina</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>N° offerta</label>
              <input style={inp} value={numeroOfferta} onChange={e => setNumeroOfferta(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Data emissione</label>
              <input style={inp} type="date" value={dataEmissione} onChange={e => setDataEmissione(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Validità (giorni)</label>
              <input style={inp} type="number" value={validitaGiorni} onChange={e => setValiditaGiorni(parseInt(e.target.value))} min={1} />
            </div>
            <div>
              <label style={lbl}>Stato</label>
              <select style={{ ...inp, borderColor: statoStyle.color }} value={stato} onChange={e => setStato(e.target.value as StatoPreventivo)}>
                {Object.entries(STATI).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: statoStyle.bg, color: statoStyle.color }}>
                {statoStyle.label}
              </span>
            </div>
          </div>
        </div>

        {/* Tipo servizio + tipo cliente */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Tipo servizio e cliente</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Tipo di servizio</label>
              <select style={inp} value={tipoServizio} onChange={e => setTipoServizio(e.target.value as TipoServizio)}>
                <option value="ingegneria">Ingegneria</option>
                <option value="fornitura_posa">Fornitura e posa in opera</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Tipo di cliente</label>
              <select style={inp} value={tipoCliente} onChange={e => setTipoCliente(e.target.value as TipoCliente)}>
                <option value="privato">Privato</option>
                <option value="ente">Ente pubblico / Comune</option>
                <option value="altro">Altro soggetto</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cliente */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12, position: 'relative' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Cliente destinatario</div>
          <div style={{ position: 'relative' }}>
            <input
              style={inp}
              value={clienteSelezionato ? clienteSelezionato.ragione_sociale : clienteFiltro}
              placeholder="Cerca per nome o P.IVA..."
              onChange={e => { setClienteFiltro(e.target.value); setClienteSelezionato(null); setDdAperto(true) }}
              onFocus={() => setDdAperto(true)}
              onBlur={() => setTimeout(() => setDdAperto(false), 180)}
            />
            {ddAperto && clientiFiltrati.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, zIndex: 99, boxShadow: '0 4px 16px rgba(0,0,0,.08)', maxHeight: 200, overflowY: 'auto' }}>
                {clientiFiltrati.map(c => (
                  <div key={c.id}
                    onMouseDown={() => { setClienteSelezionato(c); setDdAperto(false) }}
                    style={{ padding: '9px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                  >
                    <div style={{ fontWeight: 600 }}>{c.ragione_sociale}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{c.piva} · {(c as any).portafogli?.nome}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {clienteSelezionato && (
            <div style={{ marginTop: 8, background: '#f0fdf4', border: '1px solid rgba(106,176,76,.3)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#166534' }}>
              ✓ <strong>{clienteSelezionato.ragione_sociale}</strong> — P.IVA: {clienteSelezionato.piva}
              <button onClick={() => { setClienteSelezionato(null); setClienteFiltro('') }} style={{ marginLeft: 8, fontSize: 10, color: '#991b1b', background: 'none', border: 'none', cursor: 'pointer' }}>✕ rimuovi</button>
            </div>
          )}
        </div>

        {/* Oggetto */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
          <label style={lbl}>Oggetto offerta</label>
          <input style={inp} value={oggetto} onChange={e => setOggetto(e.target.value)} placeholder='Es. Offerta Economica "Chiavi in Mano" — Impianto Fotovoltaico da 1 MWp' />
        </div>

        {/* Voci */}
        <div style={{ background: 'white', borderRadius: '0 10px 10px 0', border: '1px solid #e5e5e2', borderLeft: '3px solid #6ab04c', padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Voci di preventivo</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>Modifica descrizioni · aggiungi o elimina voci · nel documento esportato appare solo il totale</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 30px', gap: 6, padding: '6px 0', borderBottom: '1px solid #f1f5f9', marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Descrizione</span>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'right' }}>Importo €</span>
            <span />
          </div>
          {sezioniUniche.map(sez => (
            <div key={sez}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '7px 12px', borderRadius: 8, margin: '14px 0 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{sez}</span>
                <button onClick={() => addVoce(sez)} style={{ fontSize: 10, fontWeight: 600, color: '#6ab04c', background: 'transparent', border: '1px solid #6ab04c', borderRadius: 20, padding: '2px 10px', cursor: 'pointer' }}>+ aggiungi voce</button>
              </div>
              {voci.map((v, idx) => v.sezione !== sez ? null : (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 30px', gap: 6, marginBottom: 5, alignItems: 'center' }}>
                  <input value={v.descrizione} onChange={e => updateVoce(idx, 'descrizione', e.target.value)} placeholder="Descrizione voce..." style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11, color: '#0f172a' }} />
                  <input type="number" value={v.importo || ''} onChange={e => updateVoce(idx, 'importo', parseFloat(e.target.value) || 0)} placeholder="0,00" style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, textAlign: 'right' }} />
                  <button onClick={() => deleteVoce(idx)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#94a3b8', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; (e.currentTarget as HTMLElement).style.color = '#991b1b' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
                  >×</button>
                </div>
              ))}
            </div>
          ))}
          <div style={{ background: '#f0fdf4', border: '1px solid rgba(106,176,76,.3)', borderRadius: 8, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>Totale imponibile</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>IVA esclusa</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f' }}>{fmt(totaleImponibile)}</div>
          </div>
        </div>

        {/* IVA solo privati */}
        {tipoCliente === 'privato' && (
          <div style={{ background: 'white', borderRadius: '0 10px 10px 0', border: '1px solid #e5e5e2', borderLeft: '3px solid #3b82f6', padding: 18, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              IVA applicabile
              <span style={{ fontSize: 10, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Solo per privati</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={lbl}>Aliquota IVA</label>
                <select style={inp} value={ivaLabel} onChange={e => {
                  const opt = IVA_OPTIONS.find(o => o.label === e.target.value)
                  setIvaLabel(e.target.value)
                  setIvaPerc(opt?.value ?? 0)
                }}>
                  {IVA_OPTIONS.map(o => <option key={o.label}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                <div style={lbl}>Imponibile</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f' }}>{fmt(totaleImponibile)}</div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                <div style={lbl}>IVA</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#475569' }}>{fmt(ivaImporto)}</div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid rgba(106,176,76,.3)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ ...lbl, color: '#166534' }}>Totale con IVA</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#166534' }}>{fmt(totaleLordo)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tranche */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Condizioni di pagamento</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px', gap: 8, marginBottom: 8 }}>
            {['Descrizione tranche', '%', 'Importo calcolato'].map(h => (
              <span key={h} style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</span>
            ))}
          </div>
          {tranche.map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px', gap: 8, marginBottom: 7, alignItems: 'center' }}>
              <input style={{ ...inp, padding: '6px 8px' }} value={t.descrizione} onChange={e => updateTranche(i, 'descrizione', e.target.value)} />
              <input style={{ ...inp, padding: '6px 8px' }} type="number" value={t.percentuale} onChange={e => updateTranche(i, 'percentuale', parseFloat(e.target.value) || 0)} min={0} max={100} />
              <span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: 13 }}>{fmt(totaleImponibile * t.percentuale / 100)}</span>
            </div>
          ))}
          {Math.abs(percTot - 100) > 0.01 && (
            <div style={{ fontSize: 11, color: '#991b1b', marginTop: 6, padding: '6px 10px', background: '#fee2e2', borderRadius: 6 }}>
              ⚠ Le percentuali sommano {percTot}% — devono fare 100%
            </div>
          )}
        </div>

        {/* Note */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e5e2', padding: 18, marginBottom: 12 }}>
          <label style={lbl}>Note aggiuntive</label>
          <textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Condizioni particolari, esclusioni, note al cliente..." />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Link href="/preventivi" style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12, textDecoration: 'none' }}>← Lista preventivi</Link>
          <div style={{ flex: 1 }} />
          <button onClick={esportaWord} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #1e3a5f', background: 'white', color: '#1e3a5f', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↓ Esporta Word
          </button>
          <button onClick={salvaModifiche} disabled={saving} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: saving ? '#94a3b8' : '#6ab04c', color: 'white', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Salvataggio...' : '💾 Salva modifiche'}
          </button>
        </div>

      </div>
    </>
  )
}
