import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, BorderStyle, WidthType, HeadingLevel,
  Header, Footer, PageNumber, UnderlineType, ShadingType,
} from 'docx'

function fmt(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}
function fmtData(d: string) {
  if (!d) return '___________'
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const BORDER_NONE = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
}
const BORDER_TABLE = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '1e3a5f' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '1e3a5f' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '1e3a5f' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '1e3a5f' },
}

function p(text: string, opts: any = {}) {
  return new Paragraph({
    children: [new TextRun({ text, ...opts })],
    spacing: { after: opts.after ?? 120 },
    alignment: opts.align ?? AlignmentType.LEFT,
  })
}

function bold(text: string, size = 22) {
  return new TextRun({ text, bold: true, size })
}

function sectionTitle(text: string) {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, color: '1e3a5f' })],
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '6ab04c' } },
  })
}

function clausola(titolo: string, testo: string) {
  return [
    new Paragraph({
      children: [new TextRun({ text: titolo, bold: true, size: 20 })],
      spacing: { before: 240, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: testo, size: 18 })],
      spacing: { after: 80 },
    }),
  ]
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: p2 } = await supabase
    .from('preventivi')
    .select('*, clienti(ragione_sociale, piva, pec, indirizzo, referente), preventivo_voci(*), preventivo_tranche(*)')
    .eq('id', params.id)
    .single()

  if (!p2) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const voci = [...(p2.preventivo_voci || [])].sort((a: any, b: any) => a.ordine - b.ordine)
  const tranche = [...(p2.preventivo_tranche || [])].sort((a: any, b: any) => a.ordine - b.ordine)
  const cliente = p2.clienti as any
  const totale = voci.reduce((acc: number, v: any) => acc + (v.importo || 0), 0)
  const ivaPerc = p2.iva_percentuale
  const isPrivato = p2.tipo_cliente === 'privato'

  // Raggruppa voci per sezione
  const sezioniMap: Record<string, any[]> = {}
  voci.forEach((v: any) => {
    if (!sezioniMap[v.sezione]) sezioniMap[v.sezione] = []
    sezioniMap[v.sezione].push(v)
  })

  // Righe tabella voci
  const voceRows: TableRow[] = []

  // Header tabella
  voceRows.push(new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'DESCRIZIONE ATTIVITÀ', bold: true, size: 18, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
        shading: { type: ShadingType.SOLID, fill: '1e3a5f' },
        width: { size: 75, type: WidthType.PERCENTAGE },
        borders: BORDER_TABLE,
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'IMPORTO', bold: true, size: 18, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
        shading: { type: ShadingType.SOLID, fill: '1e3a5f' },
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: BORDER_TABLE,
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
      }),
    ],
  }))

  Object.entries(sezioniMap).forEach(([sez, vv]) => {
    // riga intestazione sezione
    voceRows.push(new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [bold(sez.toUpperCase(), 18)], alignment: AlignmentType.LEFT })],
          columnSpan: 2,
          shading: { type: ShadingType.SOLID, fill: 'dbeafe' },
          borders: BORDER_TABLE,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
        }),
      ],
    }))
    // righe voci
    vv.forEach((v: any) => {
      voceRows.push(new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: v.descrizione, size: 18 })], alignment: AlignmentType.LEFT })],
            width: { size: 75, type: WidthType.PERCENTAGE },
            borders: BORDER_TABLE,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'a corpo', size: 18, italics: true })], alignment: AlignmentType.CENTER })],
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: BORDER_TABLE,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
          }),
        ],
      }))
    })
  })

  // Riga totale
  voceRows.push(new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [bold('TOTALE COMPLESSIVO (imponibile IVA esclusa)', 20)], alignment: AlignmentType.RIGHT })],
        shading: { type: ShadingType.SOLID, fill: 'f0fdf4' },
        borders: BORDER_TABLE,
        margins: { top: 100, bottom: 100, left: 80, right: 80 },
      }),
      new TableCell({
        children: [new Paragraph({ children: [bold(fmt(totale), 22)], alignment: AlignmentType.CENTER })],
        shading: { type: ShadingType.SOLID, fill: 'f0fdf4' },
        borders: BORDER_TABLE,
        margins: { top: 100, bottom: 100, left: 80, right: 80 },
      }),
    ],
  }))

  // Tabella tranche
  const trancheRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [bold('TRANCHE', 18, )], alignment: AlignmentType.CENTER })], shading: { type: ShadingType.SOLID, fill: '1e3a5f' }, borders: BORDER_TABLE, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '%', bold: true, size: 18, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], shading: { type: ShadingType.SOLID, fill: '1e3a5f' }, borders: BORDER_TABLE, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'IMPORTO', bold: true, size: 18, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })], shading: { type: ShadingType.SOLID, fill: '1e3a5f' }, borders: BORDER_TABLE, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
      ],
    }),
    ...tranche.map((t: any) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `• ${t.descrizione}`, size: 18 })] })], borders: BORDER_TABLE, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${t.percentuale}%`, size: 18 })], alignment: AlignmentType.CENTER })], borders: BORDER_TABLE, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: fmt(totale * t.percentuale / 100), size: 18 })], alignment: AlignmentType.CENTER })], borders: BORDER_TABLE, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
      ],
    })),
  ]

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1200, bottom: 1200, left: 1200, right: 1000 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.SINGLE, size: 6, color: '6ab04c' }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 }, insideH: { style: BorderStyle.NONE, size: 0 }, insideV: { style: BorderStyle.NONE, size: 0 } },
              rows: [new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Athena Next Gen S.r.l.', bold: true, size: 26, color: '1e3a5f' })] }),
                      new Paragraph({ children: [new TextRun({ text: 'Società di Ingegneria', size: 16, italics: true })] }),
                      new Paragraph({ children: [new TextRun({ text: 'Progettazione Impianti · Soluzioni per efficientamento energetico', size: 16, italics: true })] }),
                      new Paragraph({ children: [new TextRun({ text: 'Pratiche edilizie e progettazioni strutturali · Installazione Impianti da fonti rinnovabili', size: 16, italics: true })] }),
                    ],
                    borders: BORDER_NONE,
                  }),
                ],
              })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Athena Next Gen S.r.l. – Via Mar Della Cina, 254 – 00144 Roma – amministrazione@athenanextgen.it – +39 06 86677367 – P.IVA/C.F. 16563471008', size: 14, italics: true, color: '64748b' }),
              ],
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: '6ab04c' } },
            }),
          ],
        }),
      },
      children: [
        // Numero offerta e data
        new Paragraph({
          children: [
            bold('Offerta n. ', 22),
            new TextRun({ text: p2.numero_offerta || '', bold: true, underline: { type: UnderlineType.SINGLE }, size: 22 }),
            bold('  del  ', 22),
            new TextRun({ text: fmtData(p2.data_emissione), bold: true, underline: { type: UnderlineType.SINGLE }, size: 22 }),
          ],
          spacing: { before: 200, after: 300 },
        }),

        // Destinatario
        new Paragraph({ children: [bold('Egr./Spett.le', 20)], spacing: { after: 60 } }),
        new Paragraph({ children: [new TextRun({ text: cliente?.ragione_sociale || '_____________________________________', size: 20, bold: !!cliente })], spacing: { after: 60 } }),
        new Paragraph({ children: [new TextRun({ text: cliente?.indirizzo || '_____________________________________', size: 20 })], spacing: { after: 60 } }),
        ...(cliente?.piva ? [new Paragraph({ children: [new TextRun({ text: `P.IVA: ${cliente.piva}`, size: 18 })], spacing: { after: 60 } })] : []),
        ...(cliente?.pec ? [new Paragraph({ children: [new TextRun({ text: `PEC: ${cliente.pec}`, size: 18 })], spacing: { after: 60 } })] : []),

        new Paragraph({ children: [], spacing: { after: 120 } }),

        // Oggetto
        new Paragraph({
          children: [
            bold('Oggetto: ', 22),
            new TextRun({ text: p2.oggetto || 'Offerta Economica — Impianto Fotovoltaico', size: 22, bold: true }),
          ],
          spacing: { after: 240 },
        }),

        // Intro
        new Paragraph({
          children: [new TextRun({
            text: `In riferimento ai contatti intercorsi e su Vs. richiesta, Athena Next Gen S.r.l. è lieta di sottoporre alla Vostra attenzione la presente offerta economica. Tutte le voci di seguito elencate sono comprese nell'importo totale indicato a fondo documento.`,
            size: 20,
          })],
          spacing: { after: 300 },
          alignment: AlignmentType.JUSTIFIED,
        }),

        // Tabella voci
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: voceRows,
        }),

        // Nota IVA
        new Paragraph({
          children: [new TextRun({
            text: isPrivato && ivaPerc
              ? `Il totale è da intendersi come importo imponibile. IVA ${ivaPerc}% pari a ${fmt(totale * ivaPerc / 100)} — Totale con IVA: ${fmt(totale + totale * ivaPerc / 100)}.`
              : `Il totale complessivo è da intendersi come importo imponibile. L'IVA sarà applicata nelle aliquote di legge vigenti e dettagliata in sede di fatturazione.`,
            size: 18, italics: true, color: '64748b',
          })],
          spacing: { before: 120, after: 300 },
        }),

        // Condizioni di pagamento
        sectionTitle('Condizioni e termini di pagamento'),
        new Paragraph({
          children: [new TextRun({ text: 'Il corrispettivo sarà corrisposto nelle seguenti tranches, previa ricezione di regolare fattura, a mezzo bonifico bancario sulle coordinate indicate in fattura:', size: 20 })],
          spacing: { after: 160 },
          alignment: AlignmentType.JUSTIFIED,
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: trancheRows,
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Attenzione: le lavorazioni avranno inizio esclusivamente a seguito del ricevimento dell\'acconto sul conto corrente bancario indicato in fattura.', size: 18, bold: true })],
          spacing: { before: 160, after: 200 },
        }),

        // Attività incluse
        sectionTitle('Attività incluse nell\'offerta'),
        new Paragraph({ children: [new TextRun({ text: '• Tutte le voci elencate nella tabella computo metrico estimativo di cui sopra.', size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: '• n. 1 sopralluogo tecnico preliminare per verifica stato dei luoghi.', size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: '• Gestione completa delle comunicazioni con enti (GSE, Comune, Distributore, Terna).', size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: '• Il totale è comprensivo di spese di trasferta, bolli tecnici e ogni onere accessorio del Fornitore.', size: 20 })], spacing: { after: 80 } }),

        // Attività escluse
        sectionTitle('Attività escluse dall\'offerta'),
        new Paragraph({ children: [new TextRun({ text: '• Oneri a carico del Committente: bolli catastali, diritti di segreteria, tasse comunali/regionali, oneri ENEL.', size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: '• Opere di bonifica terreno, rimozione ostacoli preesistenti o lavori di urbanizzazione non indicati.', size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: '• Allacciamento fisico alla rete di distribuzione MT (a cura del gestore Enel Distribuzione / Terna).', size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: '• Procedure AU (Autorizzazione Unica), PAUR o VIA, qualora si rendessero necessarie: quotate separatamente.', size: 20 })], spacing: { after: 80 } }),

        // Documentazione preliminare
        sectionTitle('Documentazione preliminare da fornire dal Committente'),
        new Paragraph({ children: [new TextRun({ text: '• Planimetria catastale e aerofotogrammetrica dell\'area di installazione.', size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: '• Visura catastale aggiornata del fondo (proprietà o disponibilità dell\'area).', size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: '• Accesso al sito per sopralluogo tecnico e rilievo.', size: 20 })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: '• Documentazione catastale e urbanistica dell\'area (PRG, destinazione d\'uso, vincoli noti).', size: 20 })], spacing: { after: 80 } }),

        // Clausole standard
        ...clausola('Integrazioni e varianti',
          'Una volta avviati i lavori, eventuali modifiche o varianti rispetto alle lavorazioni descritte, superiori a n. 1 revisione concordata, formeranno oggetto di separato accordo sulla base di un nuovo preventivo e relativo ordine di modifica scritto.'),

        ...clausola(`Validità del preventivo`,
          `Il presente preventivo ha validità ${p2.validita_giorni || 20} (${numToWords(p2.validita_giorni || 20)}) giorni dalla data di emissione. Salvo errori e/o omissioni. Scaduto tale termine, Athena Next Gen S.r.l. si riserva il diritto di aggiornare le condizioni economiche in funzione delle variazioni dei costi dei materiali e della disponibilità delle risorse.`),

        ...clausola('Sospensione, recesso e risoluzione',
          'Il Committente potrà, a propria discrezione e dandone comunicazione scritta tramite PEC a studiotecnicoathena@legalmail.it, richiedere la sospensione temporanea delle lavorazioni. In tal caso il Committente corrisponderà il compenso per le lavorazioni eseguite e i materiali già approvvigionati. Il Committente potrà recedere in qualsiasi momento, restando tenuto a rimborsare le spese sostenute e le lavorazioni già eseguite.'),

        ...clausola('Diritto d\'autore',
          'La proprietà intellettuale e i diritti d\'autore relativi ai progetti e agli elaborati tecnici prodotti da Athena Next Gen S.r.l. sono riservati all\'autore anche dopo il pagamento del corrispettivo. Il Committente è tenuto a citare il nome dell\'autore in ogni pubblicazione degli elaborati.'),

        ...clausola('Controversie',
          'Per tutte le controversie che dovessero insorgere in relazione all\'interpretazione, esecuzione e risoluzione del presente contratto sarà competente in via esclusiva il Foro di Roma.'),

        ...clausola('Disposizioni finali e privacy',
          'Per quanto non esplicitamente indicato si fa riferimento al Codice Civile artt. 1655 e ss. (appalto) e alle disposizioni di legge applicabili. Con la sottoscrizione, le parti autorizzano reciprocamente il trattamento dei dati personali ai sensi del D.Lgs. 196/2003 e del GDPR (Reg. UE 2016/679), per le sole finalità connesse all\'esecuzione del contratto.'),

        // Firma
        sectionTitle('Per accettazione'),
        new Paragraph({
          children: [new TextRun({ text: 'Il Cliente dichiara di aver ricevuto tutte le informazioni necessarie e di accettare integralmente la presente proposta commerciale.', size: 20 })],
          spacing: { after: 320 },
          alignment: AlignmentType.JUSTIFIED,
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 }, insideH: { style: BorderStyle.NONE, size: 0 }, insideV: { style: BorderStyle.NONE, size: 0 } },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: 'Committente / Ragione Sociale:', bold: true, size: 18 })], spacing: { after: 40 } }),
                    new Paragraph({ children: [new TextRun({ text: cliente?.ragione_sociale || '_____________________________________________', size: 18 })], spacing: { after: 200 } }),
                    new Paragraph({ children: [new TextRun({ text: 'C.F. / P.IVA:', bold: true, size: 18 })], spacing: { after: 40 } }),
                    new Paragraph({ children: [new TextRun({ text: cliente?.piva || '_____________________________________________', size: 18 })], spacing: { after: 200 } }),
                    new Paragraph({ children: [new TextRun({ text: 'SDI / PEC:', bold: true, size: 18 })], spacing: { after: 40 } }),
                    new Paragraph({ children: [new TextRun({ text: cliente?.pec || '_____________________________________________', size: 18 })], spacing: { after: 300 } }),
                    new Paragraph({ children: [new TextRun({ text: 'Timbro e firma per accettazione', bold: true, size: 18 })], spacing: { after: 40 } }),
                    new Paragraph({ children: [new TextRun({ text: '_____________________________________________', size: 18 })] }),
                  ],
                  borders: BORDER_NONE,
                }),
                new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: 'Luogo e data:', bold: true, size: 18 })], spacing: { after: 40 } }),
                    new Paragraph({ children: [new TextRun({ text: '___________________________', size: 18 })], spacing: { after: 200 } }),
                    new Paragraph({ children: [] }),
                    new Paragraph({ children: [] }),
                    new Paragraph({ children: [] }),
                    new Paragraph({ children: [] }),
                    new Paragraph({ children: [new TextRun({ text: 'Per Athena Next Gen S.r.l.', bold: true, size: 18 })], spacing: { after: 40 } }),
                    new Paragraph({ children: [new TextRun({ text: '___________________________', size: 18 })] }),
                  ],
                  borders: BORDER_NONE,
                }),
              ],
            }),
          ],
        }),

        ...(p2.note ? [
          new Paragraph({ children: [], spacing: { after: 200 } }),
          sectionTitle('Note'),
          new Paragraph({ children: [new TextRun({ text: p2.note, size: 20 })], alignment: AlignmentType.JUSTIFIED }),
        ] : []),
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${p2.numero_offerta || 'preventivo'}.docx"`,
    },
  })
}

function numToWords(n: number): string {
  const map: Record<number, string> = {
    7: 'sette', 10: 'dieci', 14: 'quattordici', 15: 'quindici',
    20: 'venti', 30: 'trenta', 60: 'sessanta', 90: 'novanta',
  }
  return map[n] || String(n)
}
