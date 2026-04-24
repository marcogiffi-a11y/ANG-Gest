import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, BorderStyle, WidthType, HeadingLevel,
  Header, Footer, UnderlineType, ShadingType, ImageRun, VerticalAlign,
} from 'docx'

const BLUE  = '1e3a5f'
const GREEN = '6ab04c'
const WHITE = 'FFFFFF'
const GREY  = '64748b'

function fmt(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}
function fmtData(d: string) {
  if (!d) return '___________'
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const NO_BORDER = {
  top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}
const THIN_BORDER = {
  top:    { style: BorderStyle.SINGLE, size: 2, color: 'e2e8f0' },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: 'e2e8f0' },
  left:   { style: BorderStyle.SINGLE, size: 2, color: 'e2e8f0' },
  right:  { style: BorderStyle.SINGLE, size: 2, color: 'e2e8f0' },
}

function run(text: string, opts: {
  bold?: boolean; italic?: boolean; size?: number
  color?: string; underline?: boolean
} = {}) {
  return new TextRun({
    text,
    bold:      opts.bold    ?? false,
    italics:   opts.italic  ?? false,
    size:      opts.size    ?? 20,
    color:     opts.color   ?? '000000',
    underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
    font: 'Calibri',
  })
}

function para(
  children: TextRun[],
  opts: { align?: typeof AlignmentType[keyof typeof AlignmentType]; before?: number; after?: number } = {}
) {
  return new Paragraph({
    children,
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 100 },
  })
}

function cell(
  children: Paragraph[],
  opts: { bg?: string; w?: number; span?: number; align?: typeof VerticalAlign[keyof typeof VerticalAlign] } = {}
) {
  return new TableCell({
    children,
    columnSpan: opts.span,
    shading: opts.bg ? { type: ShadingType.CLEAR, fill: opts.bg, color: 'auto' } : undefined,
    width: opts.w ? { size: opts.w, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: opts.align ?? VerticalAlign.CENTER,
    borders: THIN_BORDER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  })
}

function sectionTitle(title: string): Paragraph {
  return new Paragraph({
    children: [run(title, { bold: true, size: 20, color: BLUE })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN } },
    spacing: { before: 280, after: 140 },
  })
}

function clausola(titolo: string, testo: string): Paragraph[] {
  return [
    new Paragraph({ children: [run(titolo, { bold: true, size: 20 })], spacing: { before: 260, after: 80 } }),
    new Paragraph({ children: [run(testo, { size: 19 })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 } }),
  ]
}

function bulletClausola(items: string[]): Paragraph[] {
  return items.map(t => new Paragraph({
    children: [run(`• ${t}`, { size: 19 })],
    spacing: { after: 60 },
    indent: { left: 200 },
  }))
}

function numToWords(n: number): string {
  const map: Record<number, string> = {
    7: 'sette', 10: 'dieci', 14: 'quattordici', 15: 'quindici',
    20: 'venti', 30: 'trenta', 60: 'sessanta', 90: 'novanta',
  }
  return map[n] || String(n)
}

function loadImg(filename: string): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'public', filename))
  } catch {
    return null
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: prev } = await supabase
    .from('preventivi')
    .select('*, clienti(ragione_sociale, piva, pec, sdi, indirizzo, referente), preventivo_voci(*), preventivo_tranche(*)')
    .eq('id', params.id)
    .single()

  if (!prev) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const voci    = [...(prev.preventivo_voci    || [])].sort((a: any, b: any) => a.ordine - b.ordine)
  const tranche = [...(prev.preventivo_tranche || [])].sort((a: any, b: any) => a.ordine - b.ordine)
  const cliente = prev.clienti as any
  const totale  = voci.reduce((acc: number, v: any) => acc + (v.importo || 0), 0)
  const ivaPerc = prev.iva_percentuale || 0
  const isPrivato = prev.tipo_cliente === 'privato'
  const isFornitura = prev.tipo_servizio === 'fornitura_posa'

  // Raggruppa voci per sezione
  const sezioniMap: Record<string, any[]> = {}
  for (const v of voci) {
    const s = v.sezione || 'Altre voci'
    if (!sezioniMap[s]) sezioniMap[s] = []
    sezioniMap[s].push(v)
  }

  // ── Immagini header ──────────────────────────────────────────────────────────
  const imgAng      = loadImg('logo-ang.jpg')
  const imgIso9001  = loadImg('logo-iso9001.jpg')
  const imgIso14001 = loadImg('logo-iso14001.jpg')
  const imgEge      = loadImg('logo-ege.jpg')
  const imgSerif    = loadImg('logo-serif.jpg')

  // ── Intestazione: 3 celle — logo | testo | certificazioni ────────────────────
  function makeHeaderRow(): TableRow {
    // Cella 1 — Logo ANG
    const cellLogo = new TableCell({
      children: imgAng ? [new Paragraph({
        children: [new ImageRun({ data: imgAng, transformation: { width: 85, height: 85 }, type: 'jpg' })],
        alignment: AlignmentType.LEFT,
      })] : [para([run('ATHENA NEXT GEN', { bold: true, size: 24, color: BLUE })])],
      width: { size: 20, type: WidthType.PERCENTAGE },
      borders: NO_BORDER,
      margins: { top: 0, bottom: 0, left: 0, right: 200 },
      verticalAlign: VerticalAlign.CENTER,
    })

    // Cella 2 — Testo aziendale
    const cellText = new TableCell({
      children: [
        para([run('Società di Ingegneria', { bold: true, size: 20, color: BLUE })], { after: 30 }),
        para([run('Progettazione Impianti', { size: 18, italic: true, color: GREY })], { after: 20 }),
        para([run('Soluzioni per efficientamento energetico', { size: 18, italic: true, color: GREY })], { after: 20 }),
        para([run('Pratiche edilizie e progettazioni strutturali', { size: 18, italic: true, color: GREY })], { after: 20 }),
        para([run('Installazione Impianti da fonti rinnovabili', { size: 18, italic: true, color: GREY })], { after: 0 }),
      ],
      width: { size: 40, type: WidthType.PERCENTAGE },
      borders: NO_BORDER,
      margins: { top: 0, bottom: 0, left: 200, right: 200 },
      verticalAlign: VerticalAlign.CENTER,
    })

    // Cella 3 — Loghi certificazioni
    const certChildren: Paragraph[] = []
    const certRow: ImageRun[] = []
    if (imgIso9001)  certRow.push(new ImageRun({ data: imgIso9001,  transformation: { width: 55, height: 55 }, type: 'jpg' }))
    if (imgIso14001) certRow.push(new ImageRun({ data: imgIso14001, transformation: { width: 55, height: 55 }, type: 'jpg' }))
    if (imgEge)      certRow.push(new ImageRun({ data: imgEge,      transformation: { width: 85, height: 60 }, type: 'jpg' }))
    if (certRow.length > 0) {
      certChildren.push(new Paragraph({ children: certRow, alignment: AlignmentType.RIGHT }))
    } else {
      certChildren.push(para([run('ISO 9001 · ISO 14001 · EGE', { size: 16, color: GREY })]))
    }

    const cellCerts = new TableCell({
      children: certChildren,
      width: { size: 40, type: WidthType.PERCENTAGE },
      borders: NO_BORDER,
      margins: { top: 0, bottom: 0, left: 200, right: 0 },
      verticalAlign: VerticalAlign.CENTER,
    })

    return new TableRow({ children: [cellLogo, cellText, cellCerts] })
  }

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:     { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideH: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideV: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [makeHeaderRow()],
  })

  // Linea verde sotto header
  const greenLine = new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GREEN } },
    spacing: { before: 100, after: 200 },
  })

  // ── Tabella voci ─────────────────────────────────────────────────────────────
  // Riga header tabella — blu con testo bianco
  const headerVociRow = new TableRow({
    children: [
      cell([para([run('DESCRIZIONE ATTIVITÀ', { bold: true, size: 18, color: WHITE })])],   { bg: BLUE, w: 88 }),
      cell([para([run('IMPORTO',             { bold: true, size: 18, color: WHITE })], { align: AlignmentType.CENTER })], { bg: BLUE, w: 12 }),
    ],
    tableHeader: true,
  })

  const voceRows: TableRow[] = [headerVociRow]

  for (const [sezione, vociSez] of Object.entries(sezioniMap)) {
    // Riga sezione — blu scuro
    voceRows.push(new TableRow({
      children: [
        cell([para([run(sezione, { bold: true, size: 19, color: WHITE })])], { bg: BLUE, span: 2 }),
      ],
    }))

    for (const v of vociSez) {
      const importoCell = isFornitura
        ? para([run('a corpo', { italic: true, size: 18, color: GREY })], { align: AlignmentType.CENTER })
        : para([run(v.importo > 0 ? fmt(v.importo) : 'a corpo', { size: 19 })], { align: AlignmentType.RIGHT })

      voceRows.push(new TableRow({
        children: [
          cell([para([run(v.descrizione || '', { size: 19 })])]),
          cell([importoCell]),
        ],
      }))
    }
  }

  // Riga totale
  voceRows.push(new TableRow({
    children: [
      cell([para([run('TOTALE COMPLESSIVO (imponibile IVA esclusa)', { bold: true, size: 20, color: BLUE })], { align: AlignmentType.RIGHT })], { bg: 'f0fbe8' }),
      cell([para([run(fmt(totale), { bold: true, size: 22, color: BLUE })], { align: AlignmentType.RIGHT })], { bg: 'f0fbe8' }),
    ],
  }))

  // ── Tabella tranche ───────────────────────────────────────────────────────────
  const trancheHeaderRow = new TableRow({
    children: [
      cell([para([run('CONDIZIONE',  { bold: true, size: 18, color: WHITE })])], { bg: BLUE, w: 50 }),
      cell([para([run('%',           { bold: true, size: 18, color: WHITE })], { align: AlignmentType.CENTER })], { bg: BLUE, w: 15 }),
      cell([para([run('IMPORTO',     { bold: true, size: 18, color: WHITE })], { align: AlignmentType.RIGHT })],  { bg: BLUE, w: 35 }),
    ],
    tableHeader: true,
  })

  const trancheRows: TableRow[] = [trancheHeaderRow, ...tranche.map((t: any) =>
    new TableRow({
      children: [
        cell([para([run(t.descrizione, { size: 19 })])]),
        cell([para([run(`${t.percentuale}%`, { size: 19 })], { align: AlignmentType.CENTER })]),
        cell([para([run(fmt(totale * t.percentuale / 100), { bold: true, size: 19 })], { align: AlignmentType.RIGHT })]),
      ],
    })
  )]

  // ── Footer ────────────────────────────────────────────────────────────────────
  const footerChildren: Paragraph[] = []
  if (imgSerif) {
    footerChildren.push(new Paragraph({
      children: [new ImageRun({ data: imgSerif, transformation: { width: 120, height: 38 }, type: 'jpg' })],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: GREEN } },
      spacing: { before: 80, after: 60 },
    }))
  } else {
    footerChildren.push(new Paragraph({
      children: [run('athena  next gen', { size: 16, italic: true, color: GREY })],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: GREEN } },
      spacing: { before: 80, after: 60 },
    }))
  }
  footerChildren.push(new Paragraph({
    children: [run(
      'Athena Next Gen S.r.l. – Via Mar Della Cina, 254 – 00144 Roma – amministrazione@athenanextgen.it – +39 06 86677367 – P.IVA/C.F. 16563471008',
      { size: 14, italic: true, color: GREY }
    )],
    alignment: AlignmentType.CENTER,
  }))

  // ── Documento ─────────────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 1000, right: 1000 },
        },
      },
      footers: {
        default: new Footer({ children: footerChildren }),
      },
      children: [
        // Header aziendale
        headerTable,
        greenLine,

        // Numero offerta e data
        new Paragraph({
          children: [
            run('Offerta n. ', { size: 20 }),
            run(prev.numero_offerta || '___________', { bold: true, size: 20, underline: true }),
            run('   del   ', { size: 20 }),
            run(fmtData(prev.data_emissione), { bold: true, size: 20, underline: true }),
          ],
          spacing: { after: 200 },
        }),

        // Destinatario
        para([run('Egr./Spett.le', { bold: true, size: 20 })], { after: 60 }),
        para([run(cliente?.ragione_sociale || '_____________________________________', { size: 20, bold: !!cliente?.ragione_sociale })], { after: 60 }),
        para([run(cliente?.indirizzo       || '_____________________________________', { size: 20 })], { after: 60 }),
        ...(cliente?.piva ? [para([run(`P.IVA: ${cliente.piva}`, { size: 18 })], { after: 40 })] : []),
        ...(cliente?.pec  ? [para([run(`PEC: ${cliente.pec}`,    { size: 18 })], { after: 40 })] : []),

        para([run('')], { after: 160 }),

        // Oggetto
        new Paragraph({
          children: [
            run('Oggetto: ', { bold: true, size: 22 }),
            run(prev.oggetto || 'Offerta Economica — Impianto Fotovoltaico', { bold: true, size: 22 }),
          ],
          spacing: { after: 240 },
        }),

        // Testo introduttivo
        new Paragraph({
          children: [run(
            'In riferimento ai contatti intercorsi e su Vs. richiesta, Athena Next Gen S.r.l. è lieta di sottoporre alla Vostra attenzione la presente offerta economica. L\'offerta comprende tutte le lavorazioni indicate nella tabella seguente.',
            { size: 20 }
          )],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [run('Le voci di seguito elencate sono tutte comprese nell\'importo totale indicato a fondo documento.', { size: 19, italic: true })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 280 },
        }),

        // Tabella voci
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: voceRows }),

        // Nota IVA
        new Paragraph({
          children: [run(
            isPrivato && ivaPerc
              ? `Il totale è da intendersi come importo imponibile. IVA ${ivaPerc}% pari a ${fmt(totale * ivaPerc / 100)} — Totale con IVA: ${fmt(totale + totale * ivaPerc / 100)}.`
              : 'Il totale complessivo è da intendersi come importo imponibile. L\'IVA sarà applicata nelle aliquote di legge vigenti e dettagliata in sede di fatturazione.',
            { italic: true, size: 18, color: GREY }
          )],
          spacing: { before: 140, after: 320 },
        }),

        // Condizioni di pagamento
        sectionTitle('CONDIZIONI E TERMINI DI PAGAMENTO'),
        new Paragraph({
          children: [run('Il corrispettivo sarà corrisposto nelle seguenti tranches, previa ricezione di regolare fattura, a mezzo bonifico bancario:', { size: 20 })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160 },
        }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: trancheRows }),
        new Paragraph({
          children: [run('Attenzione: le lavorazioni avranno inizio esclusivamente a seguito del ricevimento dell\'acconto sul conto corrente bancario indicato in fattura.', { bold: true, size: 18 })],
          spacing: { before: 160, after: 200 },
        }),

        // Attività incluse
        sectionTitle('ATTIVITÀ INCLUSE NELL\'OFFERTA'),
        ...bulletClausola([
          'Tutte le voci elencate nella tabella computo metrico estimativo di cui sopra.',
          'n. 1 sopralluogo tecnico preliminare per verifica stato dei luoghi.',
          'Gestione completa delle comunicazioni con enti (GSE, Comune, Distributore, Terna).',
          'Il totale è comprensivo di spese di trasferta, bolli tecnici e ogni onere accessorio del Fornitore.',
        ]),

        // Attività escluse
        sectionTitle('ATTIVITÀ ESCLUSE DALL\'OFFERTA'),
        ...bulletClausola([
          'Oneri a carico del Committente: bolli catastali, diritti di segreteria, tasse comunali/regionali, oneri ENEL.',
          'Opere di bonifica terreno, rimozione ostacoli preesistenti o lavori di urbanizzazione non indicati.',
          'Allacciamento fisico alla rete di distribuzione MT (a cura del gestore Enel Distribuzione / Terna).',
          'Sistema di accumulo energetico (batterie), se non espressamente concordato.',
          'Procedure AU (Autorizzazione Unica), PAUR o VIA, qualora si rendessero necessarie: quotate separatamente.',
          'Procedure vincolistiche (paesaggistiche, idrogeologiche, Natura 2000) se non incluse nella PAS.',
        ]),

        // Documentazione preliminare
        sectionTitle('DOCUMENTAZIONE PRELIMINARE DA FORNIRE DAL COMMITTENTE'),
        ...bulletClausola([
          'Planimetria catastale e aerofotogrammetrica dell\'area di installazione.',
          'Visura catastale aggiornata del fondo (proprietà o disponibilità dell\'area).',
          'Eventuale autorizzazione/permesso già ottenuto o in corso.',
          'Accesso al sito per sopralluogo tecnico e rilievo.',
          'Rilievi topografici o sondaggi geognostici già eseguiti (se disponibili).',
        ]),

        ...clausola('INTEGRAZIONI E VARIANTI',
          'Una volta avviati i lavori, eventuali modifiche o varianti rispetto alle lavorazioni descritte, superiori a n. 1 revisione concordata, formeranno oggetto di separato accordo sulla base di un nuovo preventivo e relativo ordine di modifica scritto.'),

        ...clausola(`VALIDITÀ DEL PREVENTIVO`,
          `Il presente preventivo ha validità ${prev.validita_giorni || 20} (${numToWords(prev.validita_giorni || 20)}) giorni dalla data di emissione. Salvo errori e/o omissioni. Scaduto tale termine, Athena Next Gen S.r.l. si riserva il diritto di aggiornare le condizioni economiche in funzione delle variazioni dei costi dei materiali e della disponibilità delle risorse.`),

        ...clausola('SOSPENSIONE, RECESSO E RISOLUZIONE',
          'Il Committente potrà, a propria discrezione e dandone comunicazione scritta tramite PEC a studiotecnicoathena@legalmail.it, richiedere la sospensione temporanea delle lavorazioni. In tal caso il Committente corrisponderà il compenso per le lavorazioni eseguite e i materiali già approvvigionati. Il Committente potrà recedere in qualsiasi momento, restando tenuto a rimborsare le spese sostenute e le lavorazioni già eseguite.'),

        ...clausola('DIRITTO D\'AUTORE',
          'La proprietà intellettuale e i diritti d\'autore relativi ai progetti e agli elaborati tecnici prodotti da Athena Next Gen S.r.l. sono riservati all\'autore anche dopo il pagamento del corrispettivo.'),

        ...clausola('CONTROVERSIE',
          'Per tutte le controversie che dovessero insorgere in relazione all\'interpretazione, esecuzione e risoluzione del presente contratto sarà competente in via esclusiva il Foro di Roma.'),

        ...clausola('DISPOSIZIONI FINALI E PRIVACY',
          'Per quanto non esplicitamente indicato si fa riferimento al Codice Civile artt. 1655 e ss. (appalto) e alle disposizioni di legge applicabili. Con la sottoscrizione, le parti autorizzano reciprocamente il trattamento dei dati personali ai sensi del D.Lgs. 196/2003 e del GDPR (Reg. UE 2016/679).'),

        // Firma
        sectionTitle('PER ACCETTAZIONE'),
        new Paragraph({
          children: [run('Il Cliente dichiara di aver ricevuto tutte le informazioni necessarie e di accettare integralmente la presente proposta commerciale.', { size: 20 })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 320 },
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 },
            left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 },
            insideH: { style: BorderStyle.NONE, size: 0 }, insideV: { style: BorderStyle.NONE, size: 0 },
          },
          rows: [new TableRow({
            children: [
              new TableCell({
                children: [
                  para([run('Committente / Ragione Sociale:', { bold: true, size: 18 })], { after: 40 }),
                  para([run(cliente?.ragione_sociale || '_____________________________________________', { size: 18 })], { after: 200 }),
                  para([run('C.F. / P.IVA:', { bold: true, size: 18 })], { after: 40 }),
                  para([run(cliente?.piva || '_____________________________________________', { size: 18 })], { after: 200 }),
                  para([run('SDI / PEC:', { bold: true, size: 18 })], { after: 40 }),
                  para([run(cliente?.pec || '_____________________________________________', { size: 18 })], { after: 300 }),
                  para([run('Timbro e firma per accettazione', { bold: true, size: 18 })], { after: 40 }),
                  para([run('_____________________________________________', { size: 18 })]),
                ],
                borders: NO_BORDER,
              }),
              new TableCell({
                children: [
                  para([run('Luogo e data:', { bold: true, size: 18 })], { after: 40 }),
                  para([run('___________________________', { size: 18 })], { after: 300 }),
                  para([run('')]), para([run('')]), para([run('')]),
                  para([run('Per Athena Next Gen S.r.l.', { bold: true, size: 18 })], { after: 40 }),
                  para([run('___________________________', { size: 18 })]),
                ],
                borders: NO_BORDER,
              }),
            ],
          })],
        }),

        ...(prev.note ? [
          para([run('')], { after: 200 }),
          sectionTitle('NOTE'),
          para([run(prev.note, { size: 20 })]),
        ] : []),
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${prev.numero_offerta || 'preventivo'}.docx"`,
    },
  })
}
