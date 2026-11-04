/**
 * Versión HTML del formato F-PM-096 (portada de la plantilla `plantilla.html` del generador
 * con Chrome headless). El navegador la imprime a PDF vectorial con la misma calidad.
 *
 * Diferencias frente a la plantilla original:
 * - Los valores del informe se insertan en las celdas y las casillas se marcan.
 * - Los espacios en blanco tienen altura mínima pero crecen con el texto.
 * - La paginación se calcula en el navegador (script incluido) con "Página X de N".
 */
import { asList, asRows, asString, type FormData } from '../form/types'
import type { Profile } from '../store/storage'
import { formatDate } from './engine'

export interface HtmlAssets {
  /** Data URL del escudo */
  escudo: string
  /** Data URL del logo PDET */
  pdet: string
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const nl = (s: string): string => esc(s).replace(/\n/g, '<br>')

/** Divide un texto largo en trozos para que las filas puedan repartirse entre páginas. */
function chunks(text: string, max = 1100): string[] {
  const out: string[] = []
  let cur = ''
  const push = () => {
    if (cur.trim()) out.push(cur.trim())
    cur = ''
  }
  for (const para of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (para.length > max) {
      push()
      let rest = para
      while (rest.length > max) {
        let cut = rest.lastIndexOf('. ', max)
        if (cut < max * 0.4) cut = rest.lastIndexOf(' ', max)
        if (cut <= 0) cut = max
        out.push(rest.slice(0, cut + 1).trim())
        rest = rest.slice(cut + 1)
      }
      cur = rest
      continue
    }
    if (cur.length + para.length + 1 > max) push()
    cur = cur ? `${cur}\n${para}` : para
  }
  push()
  return out
}

export function buildPrintHtml(data: FormData, profile: Profile, assets: HtmlAssets): string {
  const v = (key: string): string => asString(data[key])
  const val = (key: string): string => esc(v(key))
  const date = (key: string): string => esc(formatDate(v(key)))
  const cb = (on: boolean): string => `<span class="cb${on ? ' on' : ''}"></span>`
  const r = (key: string, opt: string): string => cb(v(key) === opt)
  const c = (key: string, opt: string): string => cb(asList(data[key]).includes(opt))
  const line = (key: string, min: number, fmt: (s: string) => string = esc): string =>
    `<span class="line" style="min-width:${min}px">${fmt(v(key))}</span>`
  const bullets = (key: string): string => {
    const lines = v(key)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    return lines.length ? lines.map((l) => `&bull; ${esc(l)}`).join('<br>') : '&bull; '
  }

  /** Celda con texto largo repartido en filas; `label` opcional en la primera. */
  const longRows = (key: string, opts: { colspan: number; minH: number; label?: string; cls?: string; bullets?: boolean }): string => {
    const parts = opts.bullets ? [bullets(key)] : chunks(v(key)).map(nl)
    if (parts.length === 0) parts.push('')
    return parts
      .map((p, i) => {
        const label = i === 0 && opts.label ? `<span class="b">${opts.label}</span><br>` : ''
        const minH = parts.length === 1 ? opts.minH : 0
        // "cont": continúa el trozo anterior (sin borde superior); "more": le sigue otro trozo (sin borde inferior)
        const cls = [i > 0 ? 'cont' : '', i < parts.length - 1 ? 'more' : ''].filter(Boolean).join(' ')
        return `<tr class="${cls}"><td colspan="${opts.colspan}" class="${opts.cls ?? ''}"><div class="txt" style="min-height:${minH}px">${label}${p}</div></td></tr>`
      })
      .join('')
  }

  const yesno = (key: string, noLabel = '¿Por qué?:', yesLabel = 'Descripción:'): string => {
    const val = v(key)
    return `<div>${cb(val === 'No')}No <u class="b">${noLabel}</u> &nbsp;&nbsp; ${cb(val === 'Sí')}Si <u class="b">${yesLabel}</u></div><div class="txt" style="min-height:34px">${nl(v(`${key}_texto`))}</div>`
  }

  const colgroup = (widths: number[]): string => `<colgroup>${widths.map((w) => `<col style="width:${w}%">`).join('')}</colgroup>`

  // ---------- Tablas de convivientes y contactos ----------
  const conv = asRows(data.convivientes)
  const convRows = Array.from({ length: Math.max(8, conv.length) }, (_, i) => {
    const row = conv[i] ?? {}
    return `<tr><td class="c">${i + 1}</td><td>${esc(row.nombre ?? '')}&nbsp;</td><td>${esc(row.parentesco ?? '')}&nbsp;</td><td>${esc(row.no_pariente ?? '')}&nbsp;</td><td>${cb(row.sexo === 'Mujer')}Mujer &nbsp;${cb(row.sexo === 'Hombre')}Hombre</td><td>${esc(row.edad ?? '')}&nbsp;</td><td>${esc(row.ocupacion ?? '')}&nbsp;</td></tr>`
  }).join('')
  const cont = asRows(data.contactos)
  const contRows = Array.from({ length: Math.max(4, cont.length) }, (_, i) => {
    const row = cont[i] ?? {}
    return `<tr><td style="height:20px">${esc(row.nombre ?? '')}&nbsp;</td><td>${esc(row.rol ?? '')}&nbsp;</td><td>${esc(row.contacto ?? '')}&nbsp;</td></tr>`
  }).join('')

  // ---------- Firma ----------
  const nombre = v('prof_nombre') || profile.nombre
  const tarjeta = v('prof_tarjeta') || profile.tarjeta
  const cargo = profile.cargo || 'Profesional en Trabajo Social'
  const firma = profile.firma
    ? `<img class="firma" src="${profile.firma}" alt="Firma">`
    : '<div style="height:48px"></div>'

  const nna = `${v('nombres')} ${v('apellidos')}`.trim()
  const title = esc(`Informe Trabajo Social${nna ? ` - ${nna}` : ''}`)

  const header = `
<table class="hdr">
<tr>
  <td class="logo" style="width:12%"><img src="${assets.escudo}" style="height:58px"><span>MUNICIPIO DE<br>MORALES</span></td>
  <td class="logo" style="width:14%"><img src="${assets.pdet}" style="height:62px"></td>
  <td class="title" style="width:58%"><div class="t1">ALCALDÍA MUNICIPAL<br>NIT: 891500982-6</div><div class="t2">INFORME TRABAJO SOCIAL</div></td>
  <td class="meta" style="width:16%">Fecha: junio de 2024<br>Versión: 11<br><span class="pn">Página 1 de 1</span><br>Cód.F-PM-096</td>
</tr>
</table>`

  const body = `
<table>
${colgroup([25, 25, 25, 25])}
<tr><td colspan="4" class="c b" style="font-size:9pt">FORMATO INFORME DE VALORACIÓN SOCIOFAMILIAR DE VERIFICACIÓN DE DERECHOS<br>RESTABLECIMIENTO DE DERECHOS</td></tr>
<tr><td colspan="4" class="sec">1. DATOS GENERALES</td></tr>
<tr><td class="b">Fecha de elaboración:</td><td colspan="3" style="height:18px">${date('fecha_elaboracion')}&nbsp;</td></tr>
<tr><td class="b">Elaborado por:</td><td colspan="3" style="height:18px">${val('elaborado_por')}&nbsp;</td></tr>
<tr><td class="b">Sección:</td><td colspan="3" style="height:18px">${val('seccion')}&nbsp;</td></tr>
<tr><td class="b">Tarjeta Profesional N°:</td><td colspan="3" style="height:18px">${val('tarjeta_profesional')}&nbsp;</td></tr>
<tr><td class="b">Dirigido a:</td><td colspan="3" style="height:18px">${val('dirigido_a')}&nbsp;</td></tr>
<tr><td class="b">Asunto:</td><td colspan="3" style="height:18px">${nl(v('asunto'))}&nbsp;</td></tr>
<tr><td colspan="4" class="sec">2. DATOS DEL NIÑO, NIÑA O ADOLESCENTE</td></tr>
<tr><td class="b" colspan="2">Nombre(s)</td><td class="b" colspan="2">Apellido(s)</td></tr>
<tr><td colspan="2" style="height:22px">${val('nombres')}&nbsp;</td><td colspan="2">${val('apellidos')}&nbsp;</td></tr>
</table>

<table>
${colgroup([24, 24, 18, 34])}
<tr>
  <td class="b">Fecha de nacimiento</td>
  <td class="b">Edad en años y meses</td>
  <td class="b">Sexo</td>
  <td class="b">Género (como se auto reconoce)</td>
</tr>
<tr class="opt">
  <td>${fechaDMA(v('fecha_nacimiento'))}<br><br>${c('fecha_nacimiento_desc', 'Se desconoce')}Se desconoce</td>
  <td>A <span class="line" style="min-width:28px">${val('edad_anios')}</span> M <span class="line" style="min-width:28px">${val('edad_meses')}</span><br><br>${c('edad_desc', 'Se desconoce')}Se desconoce</td>
  <td>${r('sexo', 'Mujer')}Mujer<br>${r('sexo', 'Hombre')}Hombre</td>
  <td>
    <table class="noborder" style="margin:0"><tr>
      <td style="padding:0;width:50%">${r('genero', 'Masculino')}Masculino<br>${r('genero', 'Femenino')}Femenino</td>
      <td style="padding:0">${r('genero', 'Otro')}Otro<br>&nbsp;&nbsp;Cual: ${line('genero_otro', 40)}<br>${r('genero', 'No se auto reconoce')}No se auto reconoce</td>
    </tr></table>
  </td>
</tr>
<tr>
  <td class="b">Lugar de nacimiento</td>
  <td class="b" colspan="2">Tipo y número de documento</td>
  <td class="b">Pertenencia étnica</td>
</tr>
<tr class="opt">
  <td>
    ${cb(!!v('nac_ciudad'))}Ciudad: ${line('nac_ciudad', 70)}<br>
    ${cb(!!v('nac_departamento'))}Departamento: ${line('nac_departamento', 40)}<br>
    ${cb(!!v('nac_pais'))}País: ${line('nac_pais', 80)}<br>
    ${cb(!!v('nac_nacionalidad'))}Nacionalidad(es):<br>${line('nac_nacionalidad', 120)}<br><br>
    ${c('nac_desc', 'Se desconoce')}Se desconoce
  </td>
  <td colspan="2">
    ${r('doc_tipo', 'Registro Civil')}Registro Civil<br>
    ${r('doc_tipo', 'Tarjeta de identidad')}Tarjeta de identidad<br>
    ${r('doc_tipo', 'Cédula de ciudadanía')}Cédula de ciudadanía<br>
    Número: <span class="line" style="min-width:150px">${v('doc_tipo') !== 'Documento de su país de origen' ? val('doc_numero') : ''}</span><br>
    ${r('doc_tipo', 'Documento de su país de origen')}Documento de su país de origen<br>
    &nbsp;&nbsp;&nbsp;Nombre del documento ${line('doc_nombre', 110)}<br>
    &nbsp;&nbsp;&nbsp;Número: <span class="line" style="min-width:140px">${v('doc_tipo') === 'Documento de su país de origen' ? val('doc_numero') : ''}</span><br>
    ${r('doc_tipo', 'Ninguno')}Ninguno
  </td>
  <td>
    <table class="noborder" style="margin:0"><tr>
      <td style="padding:0;width:50%">${r('etnia', 'Indígena')}Indígena:<br>&nbsp;&nbsp;Pueblo: ${line('etnia_pueblo', 30)}<br>&nbsp;&nbsp;Comunidad: ${line('etnia_comunidad', 20)}<br>${r('etnia', 'Rom o Gitano')}Rom o Gitano</td>
      <td style="padding:0">${r('etnia', 'Afrocolombiano')}Afrocolombiano<br>${r('etnia', 'Palenquero')}Palenquero<br>${r('etnia', 'Raizal')}Raizal<br>${r('etnia', 'Ninguna de las anteriores')}Ninguna de las anteriores</td>
    </tr></table>
  </td>
</tr>
<tr>
  <td class="b">Lengua natal</td>
  <td class="b" colspan="2">Discapacidad</td>
  <td class="b">Enfermedad de cuidado especial</td>
</tr>
<tr class="opt">
  <td>&nbsp;&nbsp;Cual: ${line('lengua_cual', 80)}<br>${c('lengua_bilingue', 'Bilingüe')}Bilingüe<br>&nbsp;&nbsp;Segunda lengua: ${line('lengua_segunda', 50)}</td>
  <td colspan="2">
    <table class="noborder" style="margin:0"><tr>
      <td style="padding:0;width:22%">${r('discapacidad', 'No')}No<br>${r('discapacidad', 'Sí')}Si</td>
      <td style="padding:0;width:34%">${c('discapacidad_tipo', 'Física')}Física<br>${c('discapacidad_tipo', 'Auditiva')}Auditiva<br>${c('discapacidad_tipo', 'Visual')}Visual<br>${c('discapacidad_tipo', 'Sordoceguera')}Sordoceguera</td>
      <td style="padding:0">${c('discapacidad_tipo', 'Intelectual')}Intelectual<br>${c('discapacidad_tipo', 'Psicosocial')}Psicosocial<br>${c('discapacidad_tipo', 'Múltiple')}Múltiple<br>¿Cuál? ${line('discapacidad_cual', 50)}</td>
    </tr></table>
  </td>
  <td>
    <table class="noborder" style="margin:0"><tr>
      <td style="padding:0;width:30%">${r('enfermedad', 'No')}No<br>${r('enfermedad', 'Sí')}Si</td>
      <td style="padding:0">Cual: ${line('enfermedad_cual', 60)}</td>
    </tr></table>
  </td>
</tr>
</table>

<table>
${colgroup([32, 22, 22, 24])}
<tr>
  <td class="b">Consumo de SPA</td>
  <td class="b">Situación de emergencia</td>
  <td class="b">Situación de desplazamiento</td>
  <td class="b">Situación de migración</td>
</tr>
<tr class="opt">
  <td>
    <table class="noborder" style="margin:0"><tr>
      <td style="padding:0;width:28%">${r('spa', 'No')}No<br>${r('spa', 'Sí')}Si</td>
      <td style="padding:0">${c('spa_tipo', 'Experimental')}Experimental<br>${c('spa_tipo', 'Social')}Social<br>${c('spa_tipo', 'Habitual')}Habitual<br>${c('spa_tipo', 'Problemático')}Problemático<br>Tipo de sustancia(s) ${line('spa_sustancias', 40)}</td>
    </tr></table>
  </td>
  <td>${r('emergencia', 'Sí')}Si<br>${r('emergencia', 'No')}No<br>${r('emergencia', 'No definido')}No definido</td>
  <td>${r('desplazamiento', 'Sí')}Si<br>${r('desplazamiento', 'No')}No<br>${r('desplazamiento', 'No definido')}No definido</td>
  <td>${r('migracion', 'Sí')}Si<br>${r('migracion', 'No')}No<br>&nbsp;&nbsp;Tipo: ${line('migracion_tipo', 80)}</td>
</tr>
</table>

<table>
${colgroup([18, 26, 16, 40])}
<tr><td colspan="4" class="b">Vinculación al servicio educativo</td></tr>
<tr>
  <td class="b">Escolarización</td>
  <td class="b">Nivel</td>
  <td class="b">Jornada</td>
  <td class="b">Institución Educativa</td>
</tr>
<tr class="opt">
  <td>${r('escolarizacion', 'Sí')}Si<br>${r('escolarizacion', 'No')}No</td>
  <td>${r('nivel', 'Educación inicial')}Educación inicial<br>${r('nivel', 'Preescolar')}Preescolar<br>${r('nivel', 'Básica')}Básica<br>${r('nivel', 'Media')}Media<br>Último grado cursado y aprobado: ${line('ultimo_grado', 40)}</td>
  <td>${r('jornada', 'Mañana')}Mañana<br>${r('jornada', 'Tarde')}Tarde<br>${r('jornada', 'Noche')}Noche</td>
  <td>Nombre: ${line('ie_nombre', 200)}<br><br>Sede: ${line('ie_sede', 210)}<br>Naturaleza:<br>
    <table class="noborder" style="margin:0"><tr><td style="padding:0;width:50%">${r('ie_naturaleza', 'Oficial')}Oficial</td><td style="padding:0">${r('ie_naturaleza', 'Privada')}Privada</td></tr></table>
  </td>
</tr>
<tr><td colspan="4" class="b">Aseguramiento al Sistema General de Seguridad Social en Salud -SGSSS-</td></tr>
<tr>
  <td class="b" colspan="2">Régimen de salud</td>
  <td class="b" colspan="2">EPS</td>
</tr>
<tr class="opt">
  <td colspan="2">
    <table class="noborder" style="margin:0"><tr>
      <td style="padding:0;width:50%">${r('regimen', 'Contributivo')}Contributivo<br>${r('regimen', 'Subsidiado')}Subsidiado<br>${r('regimen', 'Especial')}Especial</td>
      <td style="padding:0">${r('regimen', 'Ninguno')}Ninguno<br>${r('regimen', 'Sin información')}Sin información</td>
    </tr></table>
  </td>
  <td colspan="2" style="height:30px">${val('eps')}&nbsp;</td>
</tr>
<tr><td colspan="4" class="b">Relación de personas con quienes convive en el hogar (parientes y no parientes)</td></tr>
</table>

<table>
${colgroup([4, 32, 14, 14, 18, 8, 10])}
<tr>
  <td class="b c">#</td>
  <td class="b">Nombre</td>
  <td class="b">Parentesco</td>
  <td class="b">No pariente</td>
  <td class="b c">Sexo</td>
  <td class="b">Edad</td>
  <td class="b">Ocupación</td>
</tr>
${convRows}
</table>

<table>
${colgroup([36, 28, 36])}
<tr><td colspan="3" class="b">Personas de contacto</td></tr>
<tr>
  <td class="b">Nombre</td>
  <td class="b">Parentesco o rol</td>
  <td class="b"># de teléfono y correo electrónico</td>
</tr>
${contRows}
<tr><td colspan="3" class="b">Ubicación actual</td></tr>
<tr class="opt">
  <td>${r('ubicacion_actual', 'Centro de emergencia')}Centro de emergencia<br>${r('ubicacion_actual', 'Hogar de paso')}Hogar de paso<br>${r('ubicacion_actual', 'Centro de recuperación nutricional')}Centro de recuperación nutricional<br>${r('ubicacion_actual', 'Hogar Sustituto')}Hogar Sustituto</td>
  <td>${r('ubicacion_actual', 'Institución de salud')}Institución de salud<br>${r('ubicacion_actual', 'Familia de origen')}Familia de origen</td>
  <td>${r('ubicacion_actual', 'Familia extensa')}Familia extensa<br>${r('ubicacion_actual', 'Familia solidaria')}Familia solidaria</td>
</tr>
<tr><td colspan="3" class="sec">3. SÍNTESIS DE LA PETICIÓN QUE FUNDAMENTA LA SOLICITUD DE VALORACIÓN</td></tr>
${longRows('sintesis', { colspan: 3, minH: 55 })}
<tr><td colspan="3" class="sec">4. METODOLOGÍA UTILIZADA EN LA VALORACIÓN</td></tr>
<tr class="opt">
  <td>${c('metodologia', 'Observación')}Observación<br>${c('metodologia', 'Entrevista')}Entrevista<br>${c('metodologia', 'Elaboración e interpretación del genograma (se anexa)')}Elaboración e interpretación del genograma (se anexa)</td>
  <td>${c('metodologia', 'Perfil de vulnerabilidad/generatividad (se anexa)')}Perfil de vulnerabilidad/generatividad (se anexa)<br>${c('metodologia', 'Elaboración y análisis del ecomapa (se anexa)')}Elaboración y análisis del ecomapa (se anexa)</td>
  <td>${c('metodologia', 'Otras técnicas')}Otras técnicas<br>¿Cuáles?: ${line('metodologia_otras', 100)}</td>
</tr>
${longRows('metodologia_desc', { colspan: 3, minH: 50 })}
<tr><td colspan="3" class="sec">5. FACTORES SOCIOFAMILIARES EVIDENCIADOS POR NIVEL</td></tr>
<tr><td colspan="3" class="b">5.1. A nivel de microsistema (Valoración social del niño, niña o adolescente).</td></tr>
${longRows('micro_valoracion', { colspan: 3, minH: 55 })}
</table>

<table>
${colgroup([50, 50])}
<tr>
  <td class="b">En el entorno familiar (pares, madre, padre, familia extensa)</td>
  <td class="b">En el entorno educativo (pares, docentes, otros):</td>
</tr>
<tr class="opt">
  <td>${yesno('entorno_familiar')}</td>
  <td>${yesno('entorno_educativo')}</td>
</tr>
<tr>
  <td class="b">En el entorno comunitario (pares y/o adultos en el vecindario y/o grupos culturales, deportivos y demás formales e informales)</td>
  <td class="b">En el entorno institucional: (Instituciones que prestan algún servicio de acuerdo con necesidades específicas en salud, o atención en programas sociales)</td>
</tr>
<tr class="opt">
  <td>${yesno('entorno_comunitario')}</td>
  <td>${yesno('entorno_institucional')}</td>
</tr>
<tr><td colspan="2" class="b">A nivel de mesosistema (Caracterización de la familia del niño, niña o adolescente).</td></tr>
${longRows('meso_caracterizacion', { colspan: 2, minH: 160 })}
</table>

<table>
${colgroup([25, 25, 25, 25])}
<tr>
  <td class="b" colspan="2">Tipología familiar</td>
  <td class="b" colspan="2">Relaciones familiares</td>
</tr>
<tr class="opt">
  <td>${r('tipologia_familiar', 'Nuclear')}Nuclear<br>${r('tipologia_familiar', 'Extensa')}Extensa<br>${r('tipologia_familiar', 'Monoparental materna')}Monoparental materna<br>${r('tipologia_familiar', 'Monoparental paterna')}Monoparental paterna<br>${r('tipologia_familiar', 'Reconstituida')}Reconstituida</td>
  <td>${r('tipologia_familiar', 'De crianza/solidaria')}De crianza/solidaria<br>${r('tipologia_familiar', 'Subsistema conyugal del mismo sexo (homoparental)')}Subsistema conyugal del mismo sexo (homoparental)<br>${r('tipologia_familiar', 'Otra')}Otra ¿Cuál?: ${line('tipologia_otra', 40)}</td>
  <td>${r('relaciones_familiares', 'Muy unidos o fusionados')}Muy unidos o fusionados<br>${r('relaciones_familiares', 'Fusionados y conflictivos')}Fusionados y conflictivos<br>${r('relaciones_familiares', 'Pobre o conflictivos')}Pobre o conflictivos<br>${r('relaciones_familiares', 'Unidos')}Unidos</td>
  <td>${r('relaciones_familiares', 'Apartados o separados')}Apartados o separados<br>${r('relaciones_familiares', 'Distantes')}Distantes<br>${r('relaciones_familiares', 'Otra')}Otra: ${line('relaciones_otra', 60)}</td>
</tr>
<tr>
  <td class="b" colspan="2">Redes vinculares de apoyo</td>
  <td class="b" colspan="2">Eventos significativos y/o críticos.</td>
</tr>
<tr><td colspan="2"><div class="txt" style="min-height:60px">${nl(v('redes_vinculares'))}</div></td><td colspan="2"><div class="txt" style="min-height:60px">${nl(v('eventos_criticos'))}</div></td></tr>
<tr><td colspan="4" class="b">5.2. A nivel de exosistema.</td></tr>
${longRows('exo_descripcion', { colspan: 4, minH: 60 })}
<tr>
  <td class="b" colspan="2">Redes comunitarias</td>
  <td class="b" colspan="2">Sectores, servicios e instancias del SNBF. (Oferta de servicios orientados a la protección integral)</td>
</tr>
<tr class="opt">
  <td>${r('redes_comunitarias', 'No')}No<br>&nbsp;&nbsp;¿Por qué?<div class="txt" style="min-height:30px">${v('redes_comunitarias') === 'No' ? nl(v('redes_comunitarias_texto')) : ''}</div></td>
  <td>${r('redes_comunitarias', 'Sí')}Si<br>&nbsp;&nbsp;<u class="b">Descripción:</u><div class="txt" style="min-height:30px">${v('redes_comunitarias') === 'Sí' ? nl(v('redes_comunitarias_texto')) : ''}</div></td>
  <td>${r('snbf', 'No')}No<br>&nbsp;&nbsp;<u class="b">¿Por qué?:</u><div class="txt" style="min-height:30px">${v('snbf') === 'No' ? nl(v('snbf_texto')) : ''}</div></td>
  <td>${r('snbf', 'Sí')}Si<br>&nbsp;&nbsp;Descripción:<div class="txt" style="min-height:30px">${v('snbf') === 'Sí' ? nl(v('snbf_texto')) : ''}</div></td>
</tr>
<tr><td colspan="4" class="b">Aspectos socioeconómicos</td></tr>
<tr><td colspan="4" class="b">Condiciones de la vivienda</td></tr>
</table>

<table>
${colgroup([34, 33, 33])}
<tr>
  <td class="b">Tipo:</td>
  <td class="b">Tenencia:</td>
  <td class="b">Ubicación de la vivienda:</td>
</tr>
<tr class="opt">
  <td>
    ${r('vivienda_tipo', 'Casa')}Casa<br>${r('vivienda_tipo', 'Apartamento')}Apartamento<br>${r('vivienda_tipo', 'Cuarto(s) en inquilinato')}Cuarto (s) en inquilinato<br>${r('vivienda_tipo', 'Vivienda tradicional indígena')}Vivienda tradicional indígena<br>${r('vivienda_tipo', 'Vivienda tradicional étnica (Afrocolombiana, isleña, ROM)')}Vivienda tradicional étnica<br>&nbsp;&nbsp;&nbsp;(Afrocolombiana, isleña, ROM)<br>${r('vivienda_tipo', 'Otro')}Otro<br>&nbsp;&nbsp;¿Cual? ${line('vivienda_tipo_otro', 110)}<br>&nbsp;&nbsp;(Contenedor, carpa, embarcación, vagón, cueva, refugio natural, albergue temporal de emergencia).
  </td>
  <td>
    ${r('vivienda_tenencia', 'Propia')}Propia<br>${r('vivienda_tenencia', 'Alquiler')}Alquiler<br>${r('vivienda_tenencia', 'Familiar')}Familiar<br>${r('vivienda_tenencia', 'De la comunidad')}De la comunidad<br>${r('vivienda_tenencia', 'Invasión')}Invasión<br>${r('vivienda_tenencia', 'Posesión')}Posesión<br>${r('vivienda_tenencia', 'Otro')}Otro<br>&nbsp;&nbsp;¿Cual? ${line('vivienda_tenencia_otro', 110)}<br><br><u class="b">Observaciones:</u><div class="txt">${nl(v('vivienda_tenencia_obs'))}</div>
  </td>
  <td>
    ${r('vivienda_ubicacion', 'Residencial')}Residencial<br>${r('vivienda_ubicacion', 'Comercial')}Comercial<br>${r('vivienda_ubicacion', 'Industrial')}Industrial<br>${r('vivienda_ubicacion', 'Otro')}Otro<br>&nbsp;&nbsp;¿Cual? ${line('vivienda_ubicacion_otro', 110)}<br><br><u class="b">Observaciones:</u><div class="txt">${nl(v('vivienda_ubicacion_obs'))}</div>
  </td>
</tr>
<tr>
  <td class="b">Espacios:</td>
  <td class="b">Material predominante en paredes exteriores e interiores.</td>
  <td class="b">Material predominante piso (s)</td>
</tr>
<tr class="opt">
  <td>
    ${c('espacios', 'Baño(s)')}Baño (s)<br>${c('espacios', 'Cocina')}Cocina<br>${c('espacios', 'Dormitorios')}Dormitorios<br>${c('espacios', 'Otro(s)')}Otros(s)<br><br><u class="b">Observaciones:</u><div class="txt">${nl(v('espacios_obs'))}</div>
  </td>
  <td>
    ${r('paredes', 'Ladrillo a la vista')}Ladrillo a la vista.<br>${r('paredes', 'Bloque a la vista')}Bloque a la vista.<br>${r('paredes', 'Ladrillo o bloque revocado, pañetado o repellado')}Ladrillo o bloque revocado, pañetado o repellado.<br>${r('paredes', 'Piedra, madera pulida')}Piedra, madera pulida.<br>${r('paredes', 'Tapia pisada, adobe')}Tapia pisada, adobe.<br>${r('paredes', 'Bahareque revocado')}Bahareque revocado.<br>${r('paredes', 'Bahareque sin revocar')}Bahareque sin revocar.<br>${r('paredes', 'Madera burda, tabla, tablón')}Madera burda, tabla, tablón.<br>${r('paredes', 'Material prefabricado')}Material prefabricado.<br>${r('paredes', 'Guadua, caña, esterilla, otro vegetal')}Guadua, caña, esterilla, otro vegetal.<br>${r('paredes', 'Zinc, tela, lona, cartón, latas, desechos, plástico')}Zinc, tela, lona, cartón, latas, desechos, plástico.<br>${r('paredes', 'Sin paredes')}Sin paredes.<br><u class="b">Observaciones en cuanto a condiciones generales:</u><div class="txt">${nl(v('paredes_obs'))}</div>
  </td>
  <td>
    ${r('pisos', 'Mármol, parqué, madera pulida y lacada')}Mármol, parqué, madera pulida y lacada.<br>${r('pisos', 'Alfombra o tapete de pared a pared')}Alfombra o tapete de pared a pared.<br>${r('pisos', 'Baldosa, cerámica, vinilo, tableta, ladrillo, madera pulida sin lacar')}Baldosa, cerámica, vinilo, tableta, ladrillo, madera pulida sin lacar.<br>${r('pisos', 'Madera burda, tabla o tablón, otro vegetal')}Madera burda, tabla o tablón, otro vegetal.<br>${r('pisos', 'Cemento, gravilla')}Cemento, gravilla<br>${r('pisos', 'Tierra, arena')}Tierra, arena<br>${r('pisos', 'Otro')}Otro. Cuál: ${line('pisos_otro', 80)}<br><br><u class="b">Observaciones en cuanto a condiciones generales:</u><div class="txt">${nl(v('pisos_obs'))}</div>
  </td>
</tr>
<tr>
  <td class="b">Servicios domiciliarios (públicos y privados)</td>
  <td class="b">Entorno</td>
  <td class="b">Estrato</td>
</tr>
<tr class="opt">
  <td>
    ${c('servicios', 'Acueducto')}Acueducto<br>${c('servicios', 'Alcantarillado')}Alcantarillado<br>${c('servicios', 'Electricidad')}Electricidad<br>${c('servicios', 'Gas')}Gas<br>${c('servicios', 'Manejo de basuras')}Manejo de basuras<br>${c('servicios', 'Internet')}Internet<br>${c('servicios', 'Tv por cable')}Tv por cable<br>${c('servicios', 'Otro(s)')}Otro(s)<br>¿Cuál(es)?: ${line('servicios_otro', 120)}<br>${cb(!!v('servicios_sin'))}En caso de no contar con alguno o ninguno de los servicios esenciales, describir cómo se resuelve la necesidad:<div class="txt">${nl(v('servicios_sin'))}</div>
  </td>
  <td>
    ${r('entorno', 'Urbano')}Urbano<br>${r('entorno', 'Rural')}Rural<br>Equipamiento público:<br>${c('equipamiento', 'Alumbrado')}Alumbrado:<br>${c('equipamiento', 'Parques')}Parques:<br>${c('equipamiento', 'Escenarios deportivos, culturales y/o comunitarios')}Escenarios deportivos, culturales y/o comunitarios;<br>&nbsp;&nbsp;En caso afirmativo indique cuáles: <span class="muted">La catedral, parques, establecimientos comerciales etc.</span><div class="txt">${nl(v('equipamiento_cuales'))}</div>
  </td>
  <td>
    ${r('estrato', '0. Ninguno')}0. Ninguno<br>${r('estrato', '1. Bajo - Bajo')}1. Bajo – Bajo<br>${r('estrato', '2. Bajo')}2. Bajo<br>${r('estrato', '3. Medio bajo')}3. Medio bajo<br>${r('estrato', '4. Medio')}4. Medio<br>${r('estrato', '5. Medio alto')}5. Medio alto<br>${r('estrato', '6. Alto')}6. Alto
  </td>
</tr>
<tr><td colspan="3" class="b">Ingresos familiares</td></tr>
<tr>
  <td class="b">Monto</td>
  <td class="b">Fuente y periodicidad</td>
  <td class="b">Aportantes al presupuesto familiar</td>
</tr>
<tr class="opt">
  <td>
    ${r('ingresos_monto', 'Menor a 1 SMMLV')}Menor a 1 SMMLV<br>${r('ingresos_monto', 'Un SMMLV')}Un SMMLV<br>${r('ingresos_monto', 'Dos SMMLV')}Dos SMMLV<br>${r('ingresos_monto', 'Tres SMMLV')}Tres SMMLV<br>${r('ingresos_monto', 'Cuatro SMMLV')}Cuatro SMMLV<br>${r('ingresos_monto', 'Más de Cuatro SMMLV')}Más de Cuatro SMMLV<br>${r('ingresos_monto', 'Sin ingreso')}Sin ingreso<br>${r('ingresos_monto', 'En especie')}En especie
  </td>
  <td>
    <table class="noborder" style="margin:0"><tr>
      <td style="padding:0;width:40%">${c('ingresos_fuente', 'Salario')}Salario<br>${c('ingresos_fuente', 'Pensión')}Pensión<br>${c('ingresos_fuente', 'Ayuda familiar')}Ayuda familiar<br>${c('ingresos_fuente', 'Subsidios')}Subsidios<br>${c('ingresos_fuente', 'Donaciones')}Donaciones<br>${c('ingresos_fuente', 'Mendicidad')}Mendicidad<br>Periodicidad: ${val('ingresos_periodicidad')}</td>
      <td style="padding:0">${c('ingresos_fuente', 'Rentas, intereses, dividendos')}Rentas, intereses, dividendos<br>${c('ingresos_fuente', 'Trabajo informal')}Trabajo informal.<br>${c('ingresos_fuente', 'Ejercicio del comercio')}Ejercicio del comercio.<br>${c('ingresos_fuente', 'Otros')}Otros<br>Cual(es): ${val('ingresos_fuente_otros')}</td>
    </tr></table>
  </td>
  <td><div class="txt">${nl(v('ingresos_aportantes'))}</div></td>
</tr>
</table>

<table>
${colgroup([100])}
<tr><td class="b">&#10070; Identificación de Factores</td></tr>
${longRows('factores_identificacion', { colspan: 1, minH: 60 })}
<tr><td class="b">&#10070; Factores de Generatividad:</td></tr>
${longRows('factores_generatividad', { colspan: 1, minH: 60 })}
<tr><td class="b">&#10070; Factores Riesgo</td></tr>
${longRows('factores_riesgo', { colspan: 1, minH: 60 })}
</table>

<table>
${colgroup([100])}
<tr><td class="sec">6. Concepto integrado de valoración sociofamiliar</td></tr>
${longRows('concepto', { colspan: 1, minH: 120 })}
<tr><td class="sec">7. Análisis de derechos garantizados, amenazados y/o vulnerados desde la perspectiva social</td></tr>
<tr><td><div class="txt" style="min-height:56px"><span class="b">Derechos Vulnerados:</span><br><br>${bullets('derechos_vulnerados')}</div></td></tr>
<tr><td><div class="txt" style="min-height:56px"><span class="b">Derechos Amenazados:</span><br><br>${bullets('derechos_amenazados')}</div></td></tr>
<tr><td><div class="txt" style="min-height:56px"><span class="b">Derechos Garantizados:</span><br><br>${bullets('derechos_garantizados')}</div></td></tr>
<tr><td class="sec">8. Acciones sugeridas por niveles</td></tr>
<tr><td><div class="txt" style="min-height:90px">${bullets('acciones')}</div></td></tr>
</table>

<table class="keep">
${colgroup([50, 50])}
<tr><td colspan="2" class="sec">9. Profesional en trabajo social o desarrollo familiar responsable del informe de verificación de derechos</td></tr>
<tr>
  <td class="b">Nombre: <span class="line" style="min-width:200px">${esc(nombre)}</span></td>
  <td class="b">Fecha de elaboración del informe: <span class="line" style="min-width:100px">${date('prof_fecha_elaboracion')}</span></td>
</tr>
<tr>
  <td class="b">Tarjeta o registro profesional: <span class="line" style="min-width:140px">${esc(tarjeta)}</span></td>
  <td class="b">Fecha de entrega del informe: <span class="line" style="min-width:120px">${date('prof_fecha_entrega')}</span></td>
</tr>
<tr>
  <td style="height:90px"><span class="b">Firma:</span><div class="firma-box">${firma}<div class="firma-linea"></div><div class="b">${esc(nombre)}</div><div class="small">${esc(cargo)}${tarjeta ? ` &middot; T.P. ${esc(tarjeta)}` : ''}</div></div></td>
  <td>&nbsp;</td>
</tr>
</table>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; background: #525659; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { border: 1px solid #000; padding: 3px 4px; vertical-align: top; word-wrap: break-word; }
  .noborder td { border: none; }
  .sec { background: #e6e6e6; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .b { font-weight: bold; }
  .c { text-align: center; }
  .cb { display: inline-block; width: 8px; height: 8px; border: 1px solid #000; margin-right: 3px; vertical-align: -1px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cb.on { background: #000; }
  .line { display: inline-block; border-bottom: 1px solid #000; min-width: 90px; min-height: 10px; line-height: 10px; padding: 0 2px; vertical-align: bottom; }
  .opt { line-height: 1.4; }
  .small { font-size: 7.4pt; }
  .muted { color: #555; }
  .txt { white-space: normal; line-height: 1.35; }
  tr.cont td { border-top: none; }
  tr.more td { border-bottom: none; }
  tr.cont.first td { border-top: 1px solid #000; }
  tr.more.last td { border-bottom: 1px solid #000; }
  .firma-box { width: 60%; margin-top: 4px; text-align: center; }
  .firma { max-height: 52px; max-width: 100%; display: block; margin: 0 auto; }
  .firma-linea { border-top: 1px solid #000; margin: 2px 0 2px; }
  /* encabezado */
  .hdr { margin-bottom: 8px; }
  .hdr td { border: 1px dashed #777; padding: 4px; vertical-align: middle; }
  .hdr .logo { text-align: center; font-size: 7pt; }
  .hdr .logo img { display: block; margin: 0 auto 2px auto; }
  .hdr .title { text-align: center; }
  .hdr .title .t1 { font-size: 9.5pt; letter-spacing: .3px; }
  .hdr .title .t2 { display: inline-block; margin-top: 4px; padding: 3px 18px; border: 1px dashed #777; font-size: 17pt; font-weight: bold; color: #2e8b1e; }
  .hdr .meta { font-size: 7.5pt; text-align: center; line-height: 1.9; }
  /* páginas */
  #src { position: absolute; left: -10000px; top: 0; width: 7.4in; }
  .page { width: 8.5in; height: 11in; padding: 14mm; background: #fff; overflow: hidden; break-after: page; page-break-after: always; }
  .page:last-child { break-after: auto; page-break-after: auto; }
  .page .content { height: calc(11in - 28mm); overflow: hidden; }
  /* vista en pantalla */
  @media screen {
    #out { padding: 60px 8px 24px; }
    .page { margin: 0 auto 14px; box-shadow: 0 4px 18px rgba(0,0,0,.45); }
    #bar { position: fixed; top: 0; left: 0; right: 0; z-index: 10; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; background: #125e42; color: #fff; font-family: "Segoe UI", Roboto, Arial, sans-serif; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    #bar button { font: inherit; font-weight: 600; padding: 8px 14px; border-radius: 8px; border: 0; cursor: pointer; }
    #bar .p { background: #c99626; color: #2a1f05; }
    #bar .g { background: rgba(255,255,255,.15); color: #fff; }
    #bar .hint { opacity: .85; }
  }
  @media print {
    body { background: #fff; }
    #bar { display: none !important; }
    #out { zoom: 1 !important; padding: 0; }
    .page { margin: 0; box-shadow: none; }
  }
</style>
</head>
<body>
<div id="bar">
  <button class="p" onclick="window.print()">Guardar como PDF / Imprimir</button>
  <button class="g" onclick="window.close()">Cerrar</button>
  <span class="hint">En el cuadro de impresión elija el destino <b>“Guardar como PDF”</b>.</span>
</div>
<div id="src">${body}</div>
<div id="out"></div>
<script id="hdr" type="text/template">${header}</script>
<script>
(function () {
  var src = document.getElementById('src');
  var out = document.getElementById('out');
  var headerHtml = document.getElementById('hdr').innerHTML;
  var pages = [];
  var content;
  function newPage() {
    var p = document.createElement('div');
    p.className = 'page';
    p.innerHTML = headerHtml;
    var c = document.createElement('div');
    c.className = 'content';
    p.appendChild(c);
    out.appendChild(p);
    pages.push(p);
    content = c;
    return c;
  }
  function overflows() { return content.scrollHeight > content.clientHeight + 1; }
  newPage();
  var tables = Array.prototype.slice.call(src.children);
  tables.forEach(function (t) {
    var colgroup = t.querySelector('colgroup');
    var rows = Array.prototype.slice.call(t.rows);
    var keep = t.className.indexOf('keep') >= 0;
    var cur;
    function startTable() {
      cur = document.createElement('table');
      if (colgroup) cur.appendChild(colgroup.cloneNode(true));
      content.appendChild(cur);
    }
    startTable();
    if (keep) {
      // Tabla que no se parte (firma): si no cabe completa, va a la página siguiente.
      rows.forEach(function (r) { cur.appendChild(r); });
      if (overflows() && content.children.length > 1) {
        content.removeChild(cur);
        newPage();
        content.appendChild(cur);
      }
      return;
    }
    rows.forEach(function (r) {
      cur.appendChild(r);
      if (overflows()) {
        var onlyRow = cur.rows.length === 1 && content.children.length === 1;
        if (!onlyRow) {
          cur.removeChild(r);
          if (cur.rows.length === 0) content.removeChild(cur);
          else cur.rows[cur.rows.length - 1].classList.add('last');
          newPage();
          startTable();
          r.classList.add('first');
          cur.appendChild(r);
        }
      }
    });
  });
  src.parentNode.removeChild(src);
  pages.forEach(function (p, i) {
    p.querySelector('.pn').textContent = 'Página ' + (i + 1) + ' de ' + pages.length;
  });
  function fit() {
    var s = Math.min(1, (window.innerWidth - 16) / 816);
    out.style.zoom = s;
  }
  fit();
  window.addEventListener('resize', fit);
})();
</script>
</body>
</html>`
}

/** Fecha de nacimiento en el formato "D __ M __ A ____" del formulario. */
function fechaDMA(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  const [d, mo, a] = m ? [m[3], m[2], m[1]] : ['', '', '']
  return `D <span class="line" style="min-width:22px">${d}</span> M <span class="line" style="min-width:22px">${mo}</span> A <span class="line" style="min-width:40px">${a}</span>`
}
