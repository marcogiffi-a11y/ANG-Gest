import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'API Anthropic non configurata' }, { status: 400 })
    }

    const { documenti } = await request.json()
    // documenti: Array<{ base64: string, tipo: string, nome: string }>

    if (!documenti || documenti.length === 0) {
      return NextResponse.json({ error: 'Nessun documento fornito' }, { status: 400 })
    }

    const contentBlocks: any[] = []

    for (const doc of documenti.slice(0, 5)) {
      const isPdf = doc.tipo === 'application/pdf'
      contentBlocks.push({
        type: isPdf ? 'document' : 'image',
        source: {
          type: 'base64',
          media_type: doc.tipo || (isPdf ? 'application/pdf' : 'image/jpeg'),
          data: doc.base64,
        },
      })
    }

    contentBlocks.push({
      type: 'text',
      text: `Analizza questi documenti relativi a una pratica di connessione fotovoltaica.
Estrai tutte le informazioni rilevanti e rispondi SOLO con un JSON nel formato seguente (senza markdown, senza testo aggiuntivo):
{
  "pod": "codice POD se trovato, altrimenti null",
  "distributore": "nome distributore se trovato (es. e-distribuzione), altrimenti null",
  "tipo_soggetto": "persona_fisica o persona_giuridica",
  "note": "breve sintesi dei punti chiave trovati nei documenti",
  "checklist": {
    "ricezione": {
      "doc_id": false,
      "bolletta": false,
      "iban": false,
      "inverter": false,
      "moduli": false,
      "batterie": false,
      "visura": false,
      "gaudi_mail": false
    },
    "domanda": {
      "domanda_inviata": false,
      "mandato_inviato": false,
      "mandato_rientrato": false
    },
    "regolamento": {
      "autotest_provarele": false,
      "dico": false,
      "regolamento_inviato": false
    },
    "integrazioni": {
      "integrazione_richiesta": false,
      "integrazione_cliente": false,
      "integrazione_inviata": false
    }
  }
}
Metti true solo per gli item di cui trovi evidenza diretta nei documenti.
Regole specifiche:
- Se il documento è una bolletta elettrica: "bolletta": true, cerca il POD nel campo "Punto di prelievo" (formato IT001E...)
- Se vedi un IBAN (formato IT + 2 lettere + numeri, es. IT19L...): "iban": true, inseriscilo nelle note
- Se vedi un documento d'identità (carta d'identità, passaporto, patente): "doc_id": true
- Se vedi dati tecnici di inverter: "inverter": true
- Se vedi dati di moduli fotovoltaici: "moduli": true
- Se vedi una visura camerale: "visura": true
- Se vedi un modulo pratiche di connessione FV (con intestazione ANG o simile, con campi compilati a mano):
  * "gaudi_mail": true SE vedi QUALSIASI indirizzo email scritto (es. @gmail.com, @libero.it ecc.) — OBBLIGATORIO se c'è una email
  * "iban": true SE vedi una stringa che inizia con IT seguita da lettere e numeri (es. IT19L...)
  * "doc_id": true se c'è una spunta o V vicino a "documento d'identità"
  * "bolletta": true se c'è una spunta o V vicino a "bolletta"
  * cerca il POD scritto a mano in fondo al documento (formato IT001E...)
  * nel campo "note" inserisci TUTTI i dati leggibili: email, IBAN, codice fiscale, cellulare, foglio/particella/sub, POD`
    })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
    })

    const data = await response.json()
    if (data.error) {
      return NextResponse.json({ ok: false, raw: `Errore Anthropic: ${data.error.message}` })
    }
    const text = data.content?.find((b: any) => b.type === 'text')?.text || ''

    // Estrai JSON anche se è annidato in testo
    let parsed = null
    try {
      // Prima prova: JSON puro
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
      // Seconda prova: cerca il primo { ... } nel testo
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        try { parsed = JSON.parse(match[0]) } catch {}
      }
    }
    if (parsed) {
      return NextResponse.json({ ok: true, result: parsed })
    } else {
      return NextResponse.json({ ok: false, raw: text })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Errore analisi: ' + String(error) }, { status: 500 })
  }
}
