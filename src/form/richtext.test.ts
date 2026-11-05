import { describe, expect, it } from 'vitest'
import { parseInline, parseRich, plainText, richToHtml, splitMarker } from './richtext'

describe('richtext', () => {
  it('interpreta negrita, cursiva y subrayado', () => {
    const runs = parseInline('Hola **mundo** en *cursiva* y __subrayado__')
    expect(runs.map((r) => [r.text, r.bold, r.italic, r.underline])).toEqual([
      ['Hola ', false, false, false],
      ['mundo', true, false, false],
      [' en ', false, false, false],
      ['cursiva', false, true, false],
      [' y ', false, false, false],
      ['subrayado', false, false, true],
    ])
  })

  it('no toma guiones bajos de nombres ni asteriscos sueltos como cursiva', () => {
    expect(parseInline('correo_de_prueba y 2 * 3').map((r) => r.text).join('')).toBe('correo_de_prueba y 2 * 3')
    expect(parseInline('texto*cursiva* pegado').map((r) => [r.text, r.italic])).toEqual([
      ['texto', false],
      ['cursiva', true],
      [' pegado', false],
    ])
  })

  it('combina negrita y cursiva (***texto***)', () => {
    expect(parseInline('a ***nuevo*** b').map((r) => [r.text, r.bold, r.italic])).toEqual([
      ['a ', false, false],
      ['nuevo', true, true],
      [' b', false, false],
    ])
  })

  it('reconoce marcadores de lista', () => {
    expect(splitMarker('• Punto').marker).toBe('bullet')
    expect(splitMarker('- Guion').marker).toBe('bullet')
    expect(splitMarker('▪ Cuadro')).toMatchObject({ marker: 'square', markerText: '▪' })
    expect(splitMarker('12. Doce')).toMatchObject({ marker: 'number', markerText: '12.', rest: 'Doce' })
    expect(splitMarker('Sin marcador').marker).toBeUndefined()
  })

  it('genera HTML con sangría para listas y viñeta automática', () => {
    const html = richToHtml('• Uno **fuerte**\nTexto', {})
    expect(html).toContain('<div class="rl li"><span class="mk">•</span>Uno <b>fuerte</b></div>')
    expect(html).toContain('<div class="rl">Texto</div>')
    expect(richToHtml('Derecho a la salud', { autoBullet: true })).toContain('<span class="mk">•</span>Derecho a la salud')
    expect(richToHtml('<script>', {})).not.toContain('<script>')
  })

  it('texto plano sin marcas', () => {
    expect(plainText('1. **Primero**\n2. *Segundo*')).toBe('1. Primero\n2. Segundo')
    expect(parseRich('')).toHaveLength(1)
  })
})

describe('markupToEditorHtml', () => {
  it('agrupa listas y conserva estilos', async () => {
    const { markupToEditorHtml } = await import('../components/richEditor')
    expect(markupToEditorHtml('Hola **mundo**\n• uno\n• dos\n▪ tres\n1. cuatro\n\nfin')).toBe(
      '<div>Hola <b>mundo</b></div><ul><li>uno</li><li>dos</li></ul><ul data-square="1" style="list-style-type: square"><li>tres</li></ul><ol><li>cuatro</li></ol><div><br></div><div>fin</div>',
    )
  })
})
