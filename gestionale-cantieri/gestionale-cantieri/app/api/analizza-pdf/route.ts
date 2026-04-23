import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { pdfBase64, importoNetto } = await request.json()

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'API Anthropic non configurata' }, { status: 400 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            {
              type: 'text',
              text: `Analizza questo contratto/ordine e estrai le cadenze di fatturazione (SAL - Stati di Avanzamento Lavori).
L'importo netto totale del contratto è: €${importoNetto}

Rispondi SOLO con un JSON valido, senza testo aggiuntivo, nel seguente formato:
{
  "sal": [
    {
      "numero": 1,
      "descrizione": "descrizione del SAL",
      "percentuale": 30,
      "importo": 15000.00,
      "data_prevista": "2025-06-30"
    }
  ]
}

Se non trovi cadenze di fatturazione nel documento, restituisci: {"sal": []}
Le date devono essere nel formato YYYY-MM-DD. Se non è specificata una data, metti null.
La somma delle percentuali deve essere 100.
Calcola gli importi in base alla percentuale sull'importo netto fornito.`,
            },
          ],
        }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    let sal = []
    try {
      const parsed = JSON.parse(text)
      sal = parsed.sal || []
    } catch {
      sal = []
    }

    return NextResponse.json({ sal })
  } catch (error) {
    return NextResponse.json({ error: 'Errore analisi PDF' }, { status: 500 })
  }
}
