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
