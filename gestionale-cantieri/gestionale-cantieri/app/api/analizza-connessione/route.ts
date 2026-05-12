import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'API Anthropic non configurata' }, { status: 400 })
    }

    const { documenti } = await request.json()
    if (!documenti || documenti.length === 0) {
      return NextResponse.json({ error: 'Nessun documento fornito' }, { status: 400 })
    }

    const contentBlocks: any[] = []
    for (const doc of documenti.slice(0, 3)) {
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
      text: `Analizza questi documenti e compila il modulo di domanda di connessione fotovoltaica per e-distribuzione.
Rispondi SOLO con un JSON (senza markdown, senza testo aggiuntivo) con questa struttura esatta:
{
  "richiesta": {
    "tipo_impianto": "Un impianto di produzione di energia elettrica o null",
    "tipo_richiesta": "Nuova connessione o Adeguamento connessione esistente o null",
    "mandatario": "di essere mandatario con rappresentanza o di essere mandatario senza rappresentanza o che risulterà intestatario o null",
    "titolare_connessione_tipo": "Persona Fisica o Persona Giuridica o null",
    "email_gaudi": "email trovata o null",
    "iban": "IBAN trovato o null"
  },
  "titolare": {
    "nome": "null",
    "cognome": "null",
    "nazione_nascita": "Italia o null",
    "provincia_nascita": "null",
    "nato_a": "null",
    "data_nascita": "null",
    "codice_fiscale": "null",
    "telefono": "null",
    "email_produttore": "null",
    "residenza_nazione": "Italia o null",
    "residenza_provincia": "null",
    "residenza_comune": "null",
    "residenza_cap": "null",
    "residenza_indirizzo": "null",
    "residenza_civico": "null"
  },
  "dati_impianto": {
    "provincia": "null",
    "comune": "null",
    "localita": "null",
    "cap": "null",
    "indirizzo": "null",
    "numero_civico": "null",
    "titolarita": "Proprietario o Affittuario o null",
    "nome_impianto": "null",
    "installazione_su": "Edificio o Struttura o manufatto fuori terra o null",
    "particella": "null",
    "subalterno": "null",
    "foglio": "null",
    "regime_commerciale": "null",
    "tipo_generazione": "Fotovoltaico o null",
    "tipo_fonte": "Solare o null",
    "pod": "null",
    "potenza_richiesta_kw": "null",
    "potenza_nominale_kw": "null",
    "potenza_generazione_kw": "null",
    "inverter_presente": "SI o NO o null",
    "potenza_inverter_kw": "null",
    "tipo_tensione": "BT Monofase o BT Trifase o MT o null",
    "valore_tensione_v": "null",
    "accumulo_presente": "SI o NO o null",
    "tipologia_accumulo": "null",
    "potenza_accumulo_kw": "null",
    "capacita_accumulo_kwh": "null",
    "data_avvio_lavori": "null",
    "superbonus": "SI o NO o null",
    "incentivo": "null",
    "ritiro_energia": "GSE o altro o null",
    "tipo_remunerazione": "null"
  }
}
Estrai TUTTI i valori leggibili. Per i campi non trovati usa null (stringa). Non inventare dati.`
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
        max_tokens: 2000,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
    })

    const data = await response.json()
    if (data.error) {
      return NextResponse.json({ ok: false, raw: `Errore Anthropic: ${data.error.message}` })
    }
    const text = data.content?.find((b: any) => b.type === 'text')?.text || ''

    let parsed = null
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
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
