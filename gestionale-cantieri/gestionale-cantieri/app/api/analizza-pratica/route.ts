import { NextRequest, NextResponse } from 'next/server'

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
Per la bolletta: se il documento è una bolletta elettrica metti "bolletta": true e cerca il POD nel campo "Punto di prelievo".`
    })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
    })

    const data = await response.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || ''

    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      return NextResponse.json({ ok: true, result: parsed })
    } catch {
      return NextResponse.json({ ok: false, raw: text })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Errore analisi: ' + String(error) }, { status: 500 })
  }
}
