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
