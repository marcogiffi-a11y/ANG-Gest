export type Portafoglio = {
  id: string
  nome: string
  created_at: string
}

export type Cliente = {
  id: string
  ragione_sociale: string
  piva: string
  referente?: string
  email?: string
  telefono?: string
  pec?: string
  indirizzo?: string
  portafoglio_id: string
  portafoglio?: Portafoglio
  created_at: string
}

export type TipoServizio = 'ingegneria' | 'fornitura_posa'

export type StatoProgetto = 'bozza' | 'attivo' | 'completato' | 'sospeso'

export type Progetto = {
  id: string
  cliente_id: string
  cliente?: Cliente
  numero_ordine: string
  numero_offerta?: string
  tipo_servizio: TipoServizio
  servizi: string[]
  importo_netto: number
  cassa_percentuale: number
  iva_percentuale: number
  note?: string
  stato: StatoProgetto
  created_at: string
}

export type StatoSal = 'in_attesa' | 'da_emettere' | 'fatturato' | 'pagato'

export type Sal = {
  id: string
  progetto_id: string
  progetto?: Progetto
  numero: number
  descrizione: string
  percentuale: number
  importo: number
  data_prevista?: string
  stato: StatoSal
  created_at: string
}

export type Documento = {
  id: string
  progetto_id: string
  nome: string
  tipo: string
  url: string
  dimensione?: number
  created_at: string
}

export type ServizioIngegneria = {
  id: string
  nome: string
  ordine: number
}

// ---- PREVENTIVI ----

export type StatoPreventivo = 'bozza' | 'inviato' | 'in_attesa' | 'accettato' | 'rifiutato' | 'scaduto'
export type TipoCliente = 'privato' | 'ente' | 'altro'

/**
 * Fascia di potenza nominale impianto FV.
 * Determina il modello di computo metrico nel documento Word esportato.
 * Valorizzato solo per tipo_servizio = 'fornitura_posa'.
 *
 *   lt_11kw      → P < 11 kW        CEI 0-21 | accumulo non incluso
 *   bt_11_20kw   → 11 kW < P < 20 kW CEI 0-21 | accumulo incluso
 *   bt_20_100kw  → 20 kW < P < 100 kW CEI 0-21 | accumulo incluso | pratica UTF
 *   gt_100kw     → P > 100 kW        CEI 0-16 | cabina MT/BT | pratica UTF
 */
export type TipologiaImpianto = 'lt_11kw' | 'bt_11_20kw' | 'bt_20_100kw' | 'gt_100kw'

export const TIPOLOGIA_LABELS: Record<TipologiaImpianto, { label: string; range: string; note: string }> = {
  lt_11kw:     { label: 'Impianto residenziale',   range: 'P < 11 kW',           note: 'CEI 0-21 · Accumulo non incluso' },
  bt_11_20kw:  { label: 'Impianto piccola taglia', range: '11 kW < P < 20 kW',   note: 'CEI 0-21 · Accumulo incluso' },
  bt_20_100kw: { label: 'Impianto media taglia',   range: '20 kW < P < 100 kW',  note: 'CEI 0-21 · Accumulo incluso · Pratica UTF' },
  gt_100kw:    { label: 'Impianto utility-scale',  range: 'P > 100 kW',           note: 'CEI 0-16 · Cabina MT/BT · Pratica UTF' },
}

export type Preventivo = {
  id: string
  numero_offerta: string
  data_emissione: string
  validita_giorni: number
  stato: StatoPreventivo
  cliente_id?: string
  cliente?: Cliente
  oggetto?: string
  tipo_servizio?: TipoServizio
  tipo_cliente?: TipoCliente
  tipologia_impianto?: TipologiaImpianto   // ← NUOVO
  iva_percentuale?: number
  note?: string
  created_at: string
  preventivo_voci?: PreventivoVoce[]
  preventivo_tranche?: PreventivoTranche[]
}

export type PreventivoVoce = {
  id: string
  preventivo_id: string
  sezione: string
  descrizione: string
  importo: number
  ordine: number
}

export type PreventivoTranche = {
  id: string
  preventivo_id: string
  descrizione: string
  percentuale: number
  ordine: number
}
