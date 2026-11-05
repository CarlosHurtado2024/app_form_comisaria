import type {
  Block,
  ChecksBlock,
  Condition,
  DateBlock,
  SelectBlock,
  GroupBlock,
  HeadingBlock,
  NoteBlock,
  OtherField,
  RadioBlock,
  RowBlock,
  Section,
  TableBlock,
  TableColumn,
  TextAreaBlock,
  TextBlock,
  YesNoBlock,
} from './types'

// ---------- Constructores breves ----------
const t = (key: string, label: string, extra: Partial<TextBlock> = {}): TextBlock => ({ type: 'text', key, label, ...extra })
const d = (key: string, label: string): DateBlock => ({ type: 'date', key, label })
const ta = (key: string, label: string, rows = 4, extra: Partial<TextAreaBlock> = {}): TextAreaBlock => ({
  type: 'textarea',
  key,
  label,
  rows,
  ...extra,
})
const radio = (key: string, label: string, options: string[], extra: Partial<RadioBlock> = {}): RadioBlock => ({
  type: 'radio',
  key,
  label,
  options,
  ...extra,
})
const checks = (key: string, label: string, options: string[], extra: Partial<ChecksBlock> = {}): ChecksBlock => ({
  type: 'checks',
  key,
  label,
  options,
  ...extra,
})
const yn = (key: string, label: string, noLabel = '¿Por qué?', yesLabel = 'Descripción'): YesNoBlock => ({
  type: 'yesno',
  key,
  label,
  noLabel,
  yesLabel,
})
const row = (items: Block[], widths?: number[]): RowBlock => ({ type: 'row', items, widths })
const group = (label: string, items: Block[]): GroupBlock => ({ type: 'group', label, items })
const heading = (text: string): HeadingBlock => ({ type: 'heading', text })
const note = (text: string): NoteBlock => ({ type: 'note', text })
const table = (key: string, columns: TableColumn[], rows: number, extra: Partial<TableBlock> = {}): TableBlock => ({
  type: 'table',
  key,
  columns,
  rows,
  ...extra,
})
const other = (key: string, label = '¿Cuál?'): OtherField => ({ key, label })
const sel = (key: string, label: string, extra: Partial<SelectBlock> = {}): SelectBlock => ({ type: 'select', key, label, ...extra })
const si = (key: string): Condition => ({ key, equals: 'Sí' })
/** Asigna una condición de visibilidad a un bloque. Acepta (condición, bloque) o (bloque, condición). */
function cond<B extends Block>(a: Condition | B, b: B | Condition): B {
  const [block, when] = ('type' in a ? [a as B, b as Condition] : [b as B, a as Condition])
  return { ...block, when }
}

// ---------- Secciones ----------

export const FORM_TITLE = 'FORMATO INFORME DE VALORACIÓN SOCIOFAMILIAR DE VERIFICACIÓN DE DERECHOS'
export const FORM_SUBTITLE = 'RESTABLECIMIENTO DE DERECHOS'

export const sections: Section[] = [
  {
    id: 'generales',
    title: '1. DATOS GENERALES',
    short: 'Datos generales',
    blocks: [
      note('Estos datos se toman del perfil del profesional y pueden ajustarse para este informe.'),
      row([d('fecha_elaboracion', 'Fecha de elaboración'), t('elaborado_por', 'Elaborado por')]),
      row([t('seccion', 'Sección'), t('tarjeta_profesional', 'Tarjeta Profesional N°')]),
      t('dirigido_a', 'Dirigido a'),
      ta('asunto', 'Asunto', 2),
    ],
  },
  {
    id: 'nna',
    title: '2. DATOS DEL NIÑO, NIÑA O ADOLESCENTE',
    short: 'Datos del NNA',
    blocks: [
      row([t('nombres', 'Nombre(s)'), t('apellidos', 'Apellido(s)')]),
      row([
        group('Fecha de nacimiento', [d('fecha_nacimiento', ''), checks('fecha_nacimiento_desc', '', ['Se desconoce'])]),
        group('Edad en años y meses', [
          row([
            t('edad_anios', 'Años', { inputType: 'number', readOnlyWhen: { key: 'fecha_nacimiento', truthy: true } }),
            t('edad_meses', 'Meses', { inputType: 'number', readOnlyWhen: { key: 'fecha_nacimiento', truthy: true } }),
          ]),
          note('Se calcula automáticamente con la fecha de nacimiento y la fecha de elaboración del informe.'),
          checks('edad_desc', '', ['Se desconoce']),
        ]),
        radio('sexo', 'Sexo', ['Mujer', 'Hombre']),
        radio('genero', 'Género (como se auto reconoce)', ['Masculino', 'Femenino', 'Otro', 'No se auto reconoce'], {
          other: other('genero_otro', 'Cuál'),
          columns: 2,
        }),
      ]),
      row([
        group('Lugar de nacimiento', [
          sel('nac_pais', 'País', { optionsFrom: 'paises' }),
          sel('nac_departamento', 'Departamento', { optionsFrom: 'departamentos', placeholder: 'Seleccione el departamento' }),
          sel('nac_ciudad', 'Ciudad o municipio', { optionsFrom: 'municipios', placeholder: 'Seleccione el municipio' }),
          t('nac_nacionalidad', 'Nacionalidad(es)'),
          checks('nac_desc', '', ['Se desconoce']),
        ]),
        group('Tipo y número de documento', [
          radio('doc_tipo', '', [
            'Registro Civil',
            'Tarjeta de identidad',
            'Cédula de ciudadanía',
            'Documento de su país de origen',
            'Ninguno',
          ]),
          t('doc_nombre', 'Nombre del documento', { when: { key: 'doc_tipo', equals: 'Documento de su país de origen' } }),
          t('doc_numero', 'Número', { when: { key: 'doc_tipo', notEquals: 'Ninguno' } }),
        ]),
        group('Pertenencia étnica', [
          radio('etnia', '', ['Indígena', 'Afrocolombiano', 'Palenquero', 'Raizal', 'Rom o Gitano', 'Ninguna de las anteriores'], {
            columns: 2,
          }),
          t('etnia_pueblo', 'Pueblo', { when: { key: 'etnia', equals: 'Indígena' } }),
          t('etnia_comunidad', 'Comunidad', { when: { key: 'etnia', equals: 'Indígena' } }),
        ]),
      ]),
      row([
        group('Lengua natal', [
          t('lengua_cual', 'Cuál'),
          checks('lengua_bilingue', '', ['Bilingüe']),
          t('lengua_segunda', 'Segunda lengua', { when: { key: 'lengua_bilingue', includes: 'Bilingüe' } }),
        ]),
        group('Discapacidad', [
          radio('discapacidad', '', ['No', 'Sí']),
          checks('discapacidad_tipo', 'Tipo', ['Física', 'Auditiva', 'Visual', 'Sordoceguera', 'Intelectual', 'Psicosocial', 'Múltiple'], {
            other: other('discapacidad_cual', '¿Cuál?'),
            columns: 2,
            when: si('discapacidad'),
          }),
        ]),
        group('Enfermedad de cuidado especial', [
          radio('enfermedad', '', ['No', 'Sí']),
          t('enfermedad_cual', 'Cuál', { when: si('enfermedad') }),
        ]),
      ]),
      row([
        group('Consumo de SPA', [
          radio('spa', '', ['No', 'Sí']),
          checks('spa_tipo', 'Tipo de consumo', ['Experimental', 'Social', 'Habitual', 'Problemático'], { when: si('spa') }),
          t('spa_sustancias', 'Tipo de sustancia(s)', { when: si('spa') }),
        ]),
        radio('emergencia', 'Situación de emergencia', ['Sí', 'No', 'No definido']),
        radio('desplazamiento', 'Situación de desplazamiento', ['Sí', 'No', 'No definido']),
        group('Situación de migración', [radio('migracion', '', ['Sí', 'No']), t('migracion_tipo', 'Tipo', { when: si('migracion') })]),
      ]),
      heading('Vinculación al servicio educativo'),
      radio('escolarizacion', 'Escolarización', ['Sí', 'No']),
      cond(si('escolarizacion'), row([
          group('Nivel', [
            radio('nivel', '', ['Educación inicial', 'Preescolar', 'Básica', 'Media']),
            t('ultimo_grado', 'Último grado cursado y aprobado'),
          ]),
          radio('jornada', 'Jornada', ['Mañana', 'Tarde', 'Noche']),
          group('Institución Educativa', [
            t('ie_nombre', 'Nombre'),
            t('ie_sede', 'Sede'),
            radio('ie_naturaleza', 'Naturaleza', ['Oficial', 'Privada']),
          ]),
      ])),
      heading('Aseguramiento al Sistema General de Seguridad Social en Salud -SGSSS-'),
      row([
        radio('regimen', 'Régimen de salud', ['Contributivo', 'Subsidiado', 'Especial', 'Ninguno', 'Sin información'], { columns: 2 }),
        t('eps', 'EPS', { when: { key: 'regimen', notEquals: 'Ninguno' } }),
      ]),
      heading('Relación de personas con quienes convive en el hogar (parientes y no parientes)'),
      table(
        'convivientes',
        [
          { key: 'nombre', label: 'Nombre', width: 3 },
          { key: 'parentesco', label: 'Parentesco', width: 1.6 },
          { key: 'no_pariente', label: 'No pariente', width: 1.4 },
          { key: 'sexo', label: 'Sexo', type: 'radio', options: ['Mujer', 'Hombre'], width: 1.5 },
          { key: 'edad', label: 'Edad', type: 'number', width: 0.7 },
          { key: 'ocupacion', label: 'Ocupación', width: 1.8 },
        ],
        8,
        { rowName: 'Persona' },
      ),
      heading('Personas de contacto'),
      table(
        'contactos',
        [
          { key: 'nombre', label: 'Nombre', width: 2 },
          { key: 'rol', label: 'Parentesco o rol', width: 1.5 },
          { key: 'contacto', label: '# de teléfono y correo electrónico', width: 2 },
        ],
        4,
        { rowName: 'Contacto' },
      ),
      radio(
        'ubicacion_actual',
        'Ubicación actual',
        [
          'Centro de emergencia',
          'Hogar de paso',
          'Centro de recuperación nutricional',
          'Hogar Sustituto',
          'Institución de salud',
          'Familia de origen',
          'Familia extensa',
          'Familia solidaria',
        ],
        { columns: 3 },
      ),
    ],
  },
  {
    id: 'sintesis',
    title: '3. SÍNTESIS DE LA PETICIÓN QUE FUNDAMENTA LA SOLICITUD DE VALORACIÓN',
    short: 'Síntesis de la petición',
    blocks: [ta('sintesis', '', 8, { hint: 'Describa los hechos y la petición que motiva la valoración sociofamiliar.' })],
  },
  {
    id: 'metodologia',
    title: '4. METODOLOGÍA UTILIZADA EN LA VALORACIÓN',
    short: 'Metodología',
    blocks: [
      checks(
        'metodologia',
        '',
        [
          'Observación',
          'Entrevista',
          'Elaboración e interpretación del genograma (se anexa)',
          'Perfil de vulnerabilidad/generatividad (se anexa)',
          'Elaboración y análisis del ecomapa (se anexa)',
          'Otras técnicas',
        ],
        { other: other('metodologia_otras', '¿Cuáles?'), columns: 3 },
      ),
      ta('metodologia_desc', 'Descripción de la metodología', 5),
    ],
  },
  {
    id: 'factores',
    title: '5. FACTORES SOCIOFAMILIARES EVIDENCIADOS POR NIVEL',
    short: 'Factores por nivel',
    blocks: [
      heading('5.1. A nivel de microsistema (Valoración social del niño, niña o adolescente).'),
      ta('micro_valoracion', '', 6),
      row([
        yn('entorno_familiar', 'En el entorno familiar (pares, madre, padre, familia extensa)'),
        yn('entorno_educativo', 'En el entorno educativo (pares, docentes, otros)'),
      ]),
      row([
        yn(
          'entorno_comunitario',
          'En el entorno comunitario (pares y/o adultos en el vecindario y/o grupos culturales, deportivos y demás formales e informales)',
        ),
        yn(
          'entorno_institucional',
          'En el entorno institucional (Instituciones que prestan algún servicio de acuerdo con necesidades específicas en salud, o atención en programas sociales)',
        ),
      ]),
      heading('A nivel de mesosistema (Caracterización de la familia del niño, niña o adolescente).'),
      ta('meso_caracterizacion', '', 10),
      row([
        radio(
          'tipologia_familiar',
          'Tipología familiar',
          [
            'Nuclear',
            'Extensa',
            'Monoparental materna',
            'Monoparental paterna',
            'Reconstituida',
            'De crianza/solidaria',
            'Subsistema conyugal del mismo sexo (homoparental)',
            'Otra',
          ],
          { other: other('tipologia_otra', '¿Cuál?'), columns: 2 },
        ),
        radio(
          'relaciones_familiares',
          'Relaciones familiares',
          ['Muy unidos o fusionados', 'Fusionados y conflictivos', 'Pobre o conflictivos', 'Unidos', 'Apartados o separados', 'Distantes', 'Otra'],
          { other: other('relaciones_otra', 'Otra'), columns: 2 },
        ),
      ]),
      row([ta('redes_vinculares', 'Redes vinculares de apoyo', 4), ta('eventos_criticos', 'Eventos significativos y/o críticos', 4)]),
      heading('5.2. A nivel de exosistema.'),
      ta('exo_descripcion', '', 4),
      row([
        yn('redes_comunitarias', 'Redes comunitarias'),
        yn('snbf', 'Sectores, servicios e instancias del SNBF (Oferta de servicios orientados a la protección integral)'),
      ]),
      heading('Aspectos socioeconómicos — Condiciones de la vivienda'),
      row([
        radio(
          'vivienda_tipo',
          'Tipo',
          [
            'Casa',
            'Apartamento',
            'Cuarto(s) en inquilinato',
            'Vivienda tradicional indígena',
            'Vivienda tradicional étnica (Afrocolombiana, isleña, ROM)',
            'Otro',
          ],
          { other: other('vivienda_tipo_otro', '¿Cuál? (contenedor, carpa, embarcación, vagón, cueva, refugio natural, albergue temporal)') },
        ),
        group('Tenencia', [
          radio('vivienda_tenencia', '', ['Propia', 'Alquiler', 'Familiar', 'De la comunidad', 'Invasión', 'Posesión', 'Otro'], {
            other: other('vivienda_tenencia_otro', '¿Cuál?'),
          }),
          ta('vivienda_tenencia_obs', 'Observaciones', 2),
        ]),
        group('Ubicación de la vivienda', [
          radio('vivienda_ubicacion', '', ['Residencial', 'Comercial', 'Industrial', 'Otro'], {
            other: other('vivienda_ubicacion_otro', '¿Cuál?'),
          }),
          ta('vivienda_ubicacion_obs', 'Observaciones', 2),
        ]),
      ]),
      row([
        group('Espacios', [
          checks('espacios', '', ['Baño(s)', 'Cocina', 'Dormitorios', 'Otro(s)']),
          ta('espacios_obs', 'Observaciones', 3),
        ]),
        group('Material predominante en paredes exteriores e interiores', [
          radio('paredes', '', [
            'Ladrillo a la vista',
            'Bloque a la vista',
            'Ladrillo o bloque revocado, pañetado o repellado',
            'Piedra, madera pulida',
            'Tapia pisada, adobe',
            'Bahareque revocado',
            'Bahareque sin revocar',
            'Madera burda, tabla, tablón',
            'Material prefabricado',
            'Guadua, caña, esterilla, otro vegetal',
            'Zinc, tela, lona, cartón, latas, desechos, plástico',
            'Sin paredes',
          ]),
          ta('paredes_obs', 'Observaciones en cuanto a condiciones generales', 2),
        ]),
        group('Material predominante piso(s)', [
          radio('pisos', '', [
            'Mármol, parqué, madera pulida y lacada',
            'Alfombra o tapete de pared a pared',
            'Baldosa, cerámica, vinilo, tableta, ladrillo, madera pulida sin lacar',
            'Madera burda, tabla o tablón, otro vegetal',
            'Cemento, gravilla',
            'Tierra, arena',
            'Otro',
          ], { other: other('pisos_otro', 'Cuál') }),
          ta('pisos_obs', 'Observaciones en cuanto a condiciones generales', 2),
        ]),
      ]),
      row([
        group('Servicios domiciliarios (públicos y privados)', [
          checks('servicios', '', ['Acueducto', 'Alcantarillado', 'Electricidad', 'Gas', 'Manejo de basuras', 'Internet', 'Tv por cable', 'Otro(s)'], {
            other: other('servicios_otro', '¿Cuál(es)?'),
            columns: 2,
          }),
          ta('servicios_sin', 'En caso de no contar con alguno o ninguno de los servicios esenciales, describir cómo se resuelve la necesidad', 2),
        ]),
        group('Entorno', [
          radio('entorno', '', ['Urbano', 'Rural']),
          checks('equipamiento', 'Equipamiento público', ['Alumbrado', 'Parques', 'Escenarios deportivos, culturales y/o comunitarios']),
          ta('equipamiento_cuales', 'En caso afirmativo indique cuáles (la catedral, parques, establecimientos comerciales, etc.)', 2),
        ]),
        radio('estrato', 'Estrato', ['0. Ninguno', '1. Bajo - Bajo', '2. Bajo', '3. Medio bajo', '4. Medio', '5. Medio alto', '6. Alto']),
      ]),
      heading('Ingresos familiares'),
      row([
        radio('ingresos_monto', 'Monto', [
          'Menor a 1 SMMLV',
          'Un SMMLV',
          'Dos SMMLV',
          'Tres SMMLV',
          'Cuatro SMMLV',
          'Más de Cuatro SMMLV',
          'Sin ingreso',
          'En especie',
        ]),
        cond(group('Fuente y periodicidad', [
          checks('ingresos_fuente', 'Fuente', [
            'Salario',
            'Pensión',
            'Ayuda familiar',
            'Subsidios',
            'Donaciones',
            'Mendicidad',
            'Rentas, intereses, dividendos',
            'Trabajo informal',
            'Ejercicio del comercio',
            'Otros',
          ], { other: other('ingresos_fuente_otros', 'Cuál(es)'), columns: 2 }),
          radio('ingresos_periodicidad', 'Periodicidad', ['Diaria', 'Semanal', 'Quincenal', 'Mensual']),
        ]), { key: 'ingresos_monto', notEquals: 'Sin ingreso' }),
        ta('ingresos_aportantes', 'Aportantes al presupuesto familiar', 4),
      ]),
      heading('Identificación de Factores'),
      ta('factores_identificacion', 'Identificación de factores', 4),
      ta('factores_generatividad', 'Factores de Generatividad', 4),
      ta('factores_riesgo', 'Factores de Riesgo', 4),
    ],
  },
  {
    id: 'concepto',
    title: '6. CONCEPTO INTEGRADO DE VALORACIÓN SOCIOFAMILIAR',
    short: 'Concepto integrado',
    blocks: [ta('concepto', '', 10)],
  },
  {
    id: 'derechos',
    title: '7. ANÁLISIS DE DERECHOS GARANTIZADOS, AMENAZADOS Y/O VULNERADOS DESDE LA PERSPECTIVA SOCIAL',
    short: 'Análisis de derechos',
    blocks: [
      ta('derechos_vulnerados', 'Derechos Vulnerados', 4, { bullets: true, hint: 'Un derecho por línea.' }),
      ta('derechos_amenazados', 'Derechos Amenazados', 4, { bullets: true, hint: 'Un derecho por línea.' }),
      ta('derechos_garantizados', 'Derechos Garantizados', 4, { bullets: true, hint: 'Un derecho por línea.' }),
    ],
  },
  {
    id: 'acciones',
    title: '8. ACCIONES SUGERIDAS POR NIVELES',
    short: 'Acciones sugeridas',
    blocks: [ta('acciones', '', 8, { bullets: true, hint: 'Una acción por línea.' })],
  },
  {
    id: 'profesional',
    title: '9. PROFESIONAL EN TRABAJO SOCIAL O DESARROLLO FAMILIAR RESPONSABLE DEL INFORME DE VERIFICACIÓN DE DERECHOS',
    short: 'Profesional y firma',
    blocks: [
      row([t('prof_nombre', 'Nombre'), d('prof_fecha_elaboracion', 'Fecha de elaboración del informe')]),
      row([t('prof_tarjeta', 'Tarjeta o registro profesional'), d('prof_fecha_entrega', 'Fecha de entrega del informe')]),
    ],
  },
  {
    id: 'evidencia',
    title: 'ANEXO. EVIDENCIA FOTOGRÁFICA (OPCIONAL)',
    short: 'Evidencia fotográfica',
    blocks: [
      note('Las fotografías se guardan de forma segura asociadas a este informe y se incluyen como anexo al final del PDF.'),
      yn('anexa_evidencia', '¿Anexa evidencia fotográfica al informe?', '', ''),
      { type: 'fotos', key: 'evidencias', label: 'Fotografías', enabledBy: 'anexa_evidencia' },
    ],
  },
]

export const sectionById = (id: string): Section | undefined => sections.find((s) => s.id === id)
