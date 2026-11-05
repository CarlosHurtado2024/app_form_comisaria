import { useId } from 'react'
import {
  asList,
  asRows,
  asString,
  type Block,
  type ChecksBlock,
  type RadioBlock,
  type SelectBlock,
  type TableBlock,
  type TableRow,
  type TextBlock,
  type YesNoBlock,
} from '../form/types'
import { isVisible, matches, selectOptions } from '../form/visibility'
import { EvidenceField } from './EvidenceField'
import { RichTextArea } from './RichTextArea'
import { useForm } from './FormContext'

const CheckIcon = () => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function Label({ id, text, hint }: { id: string; text: string; hint?: string }) {
  if (!text && !hint) return null
  return (
    <>
      {text && (
        <label className="field__label" htmlFor={id}>
          {text}
        </label>
      )}
      {hint && <span className="field__hint">{hint}</span>}
    </>
  )
}

function TextField({ block }: { block: TextBlock }) {
  const { data, set } = useForm()
  const id = useId()
  const readOnly = !!block.readOnlyWhen && matches(block.readOnlyWhen, data)
  return (
    <div className="field">
      <Label id={id} text={block.label} hint={block.hint} />
      <input
        id={id}
        className="input"
        type={block.inputType ?? 'text'}
        inputMode={block.inputType === 'number' ? 'numeric' : undefined}
        placeholder={block.placeholder}
        value={asString(data[block.key])}
        onChange={(e) => set(block.key, e.target.value)}
        readOnly={readOnly}
        aria-label={block.label || undefined}
      />
    </div>
  )
}

function SelectField({ block }: { block: SelectBlock }) {
  const { data, set } = useForm()
  const id = useId()
  const value = asString(data[block.key])
  const options = selectOptions(block, data)
  if (!options) {
    return (
      <div className="field">
        <Label id={id} text={block.label} />
        <input id={id} className="input" type="text" value={value} placeholder={block.placeholder} onChange={(e) => set(block.key, e.target.value)} />
      </div>
    )
  }
  const list = value && !options.includes(value) ? [value, ...options] : options
  return (
    <div className="field">
      <Label id={id} text={block.label} />
      <select id={id} className="input" value={value} onChange={(e) => set(block.key, e.target.value)}>
        <option value="">{block.placeholder ?? 'Seleccione…'}</option>
        {list.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

function DateField({ block }: { block: Extract<Block, { type: 'date' }> }) {
  const { data, set } = useForm()
  const id = useId()
  return (
    <div className="field">
      <Label id={id} text={block.label} />
      <input id={id} className="input" type="date" value={asString(data[block.key])} onChange={(e) => set(block.key, e.target.value)} aria-label={block.label || 'Fecha'} />
    </div>
  )
}

function TextAreaField({ block }: { block: Extract<Block, { type: 'textarea' }> }) {
  const { data, set } = useForm()
  const id = useId()
  return (
    <div className="field">
      <Label id={id} text={block.label} hint={block.hint} />
      <RichTextArea id={id} rows={block.rows ?? 4} value={asString(data[block.key])} onChange={(v) => set(block.key, v)} ariaLabel={block.label || 'Texto'} />
    </div>
  )
}

function OtherField({ other, visible }: { other: { key: string; label: string }; visible: boolean }) {
  const { data, set } = useForm()
  const id = useId()
  if (!visible) return null
  return (
    <div className="field">
      <Label id={id} text={other.label} />
      <input id={id} className="input" type="text" value={asString(data[other.key])} onChange={(e) => set(other.key, e.target.value)} />
    </div>
  )
}

const OTHER_WORDS = /^(otro|otra|otros|otras|otras técnicas|otro\(s\)|sí|si)\b/i

function RadioField({ block }: { block: RadioBlock }) {
  const { data, set } = useForm()
  const value = asString(data[block.key])
  const showOther = !!block.other && (OTHER_WORDS.test(value) || !block.options.some((o) => OTHER_WORDS.test(o)))
  return (
    <div className="field" role="radiogroup" aria-label={block.label || undefined}>
      {block.label && <span className="field__label">{block.label}</span>}
      <div className="chips">
        {block.options.map((o) => {
          const on = value === o
          return (
            <button
              type="button"
              key={o}
              role="radio"
              aria-checked={on}
              className={`chip chip--radio${on ? ' chip--on' : ''}`}
              onClick={() => set(block.key, on ? '' : o)}
            >
              <span className="chip__box">
                <CheckIcon />
              </span>
              {o}
            </button>
          )
        })}
      </div>
      {block.other && <OtherField other={block.other} visible={showOther} />}
    </div>
  )
}

function ChecksField({ block }: { block: ChecksBlock }) {
  const { data, set } = useForm()
  const values = asList(data[block.key])
  const toggle = (o: string) => set(block.key, values.includes(o) ? values.filter((v) => v !== o) : [...values, o])
  const showOther = !!block.other && (values.some((v) => OTHER_WORDS.test(v)) || !block.options.some((o) => OTHER_WORDS.test(o)))
  return (
    <div className="field" role="group" aria-label={block.label || undefined}>
      {block.label && <span className="field__label">{block.label}</span>}
      <div className="chips">
        {block.options.map((o) => {
          const on = values.includes(o)
          return (
            <button type="button" key={o} role="checkbox" aria-checked={on} className={`chip${on ? ' chip--on' : ''}`} onClick={() => toggle(o)}>
              <span className="chip__box">
                <CheckIcon />
              </span>
              {o}
            </button>
          )
        })}
      </div>
      {block.other && <OtherField other={block.other} visible={showOther} />}
    </div>
  )
}

function YesNoField({ block }: { block: YesNoBlock }) {
  const { data, set } = useForm()
  const value = asString(data[block.key])
  const textKey = `${block.key}_texto`
  const id = useId()
  const textLabel = value === 'No' ? block.noLabel : value === 'Sí' ? block.yesLabel : undefined
  return (
    <div className="field">
      <span className="field__label">{block.label}</span>
      <div className="yn" role="radiogroup" aria-label={block.label}>
        {(['Sí', 'No'] as const).map((o) => {
          const on = value === o
          return (
            <button
              type="button"
              key={o}
              role="radio"
              aria-checked={on}
              className={on ? `on ${o === 'Sí' ? 'on--si' : 'on--no'}` : ''}
              onClick={() => set(block.key, on ? '' : o)}
            >
              <span className="yn__ico" aria-hidden="true">
                {o === 'Sí' ? '✓' : '✕'}
              </span>
              {o}
            </button>
          )
        })}
      </div>
      {textLabel && (
        <div className={`yn-text${value === 'No' ? ' yn-text--no' : ''}`}>
          <label htmlFor={id}>{textLabel}</label>
          <RichTextArea id={id} rows={3} value={asString(data[textKey])} onChange={(v) => set(textKey, v)} ariaLabel={textLabel} />
        </div>
      )}
    </div>
  )
}

function TableField({ block }: { block: TableBlock }) {
  const { data, set } = useForm()
  const rows = asRows(data[block.key])
  const shown: TableRow[] = rows.length ? rows : [{}]
  const update = (i: number, key: string, value: string) => {
    const next = shown.map((r, idx) => (idx === i ? { ...r, [key]: value } : r))
    set(block.key, next)
  }
  const add = () => set(block.key, [...shown, {}])
  const remove = (i: number) => set(block.key, shown.filter((_, idx) => idx !== i))
  const weights = block.columns.map((c) => `minmax(0, ${c.width ?? 1}fr)`).join(' ')
  const rowName = block.rowName ?? 'Fila'
  return (
    <div className="field">
      {block.label && <span className="field__label">{block.label}</span>}
      <div className="tbl tbl--wide" style={{ '--tbl-cols': weights } as React.CSSProperties}>
        <div className="tbl__head" aria-hidden="true">
          <span>#</span>
          <div className="tbl__headcells">
            {block.columns.map((c) => (
              <span key={c.key}>{c.label}</span>
            ))}
          </div>
          <span />
        </div>
        {shown.map((row, i) => (
          <div className="tbl__row" key={i}>
            <span className="tbl__rowname">
              {rowName} {i + 1}
            </span>
            <div className="tbl__del">
              <button
                type="button"
                className="btn btn--danger btn--sm btn--icon"
                aria-label={`Eliminar ${rowName} ${i + 1}`}
                onClick={() => remove(i)}
                disabled={shown.length === 1 && Object.keys(row).length === 0}
              >
                ✕
              </button>
            </div>
            <div className="tbl__cells">
              {block.columns.map((c) => (
                <div className={`tbl__cell${(c.width ?? 1) >= 1.8 ? ' tbl__cell--wide' : ''}`} key={c.key}>
                  <span>{c.label}</span>
                  {c.type === 'radio' && c.options ? (
                    <div className="seg" role="radiogroup" aria-label={`${c.label} ${rowName} ${i + 1}`}>
                      {c.options.map((o) => (
                        <button
                          type="button"
                          key={o}
                          role="radio"
                          aria-checked={row[c.key] === o}
                          className={row[c.key] === o ? 'on' : ''}
                          onClick={() => update(i, c.key, row[c.key] === o ? '' : o)}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      className="input"
                      type={c.type === 'number' ? 'number' : 'text'}
                      inputMode={c.type === 'number' ? 'numeric' : undefined}
                      aria-label={`${c.label} ${rowName} ${i + 1}`}
                      placeholder={c.label}
                      value={row[c.key] ?? ''}
                      onChange={(e) => update(i, c.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={add} disabled={shown.length >= Math.max(block.rows, 12)}>
          + Agregar {rowName.toLowerCase()}
        </button>
      </div>
    </div>
  )
}

export function BlockView({ block }: { block: Block }) {
  const { data } = useForm()
  if (!isVisible(block, data)) return null
  switch (block.type) {
    case 'text':
      return <TextField block={block} />
    case 'select':
      return <SelectField block={block} />
    case 'date':
      return <DateField block={block} />
    case 'textarea':
      return <TextAreaField block={block} />
    case 'radio':
      return <RadioField block={block} />
    case 'checks':
      return <ChecksField block={block} />
    case 'yesno':
      return <YesNoField block={block} />
    case 'table':
      return <TableField block={block} />
    case 'heading':
      return <div className="f-heading">{block.text}</div>
    case 'note':
      return <div className="f-note">{block.text}</div>
    case 'fotos':
      return <EvidenceField block={block} />
    case 'row': {
      const items = block.items.filter((it) => isVisible(it, data))
      if (items.length === 0) return null
      return (
        <div className="f-row" style={{ '--cols': Math.min(items.length, 4) } as React.CSSProperties}>
          {items.map((it, i) => (
            <BlockView key={i} block={it} />
          ))}
        </div>
      )
    }
    case 'group':
      return (
        <fieldset className="f-group">
          <legend>{block.label}</legend>
          {block.items.map((it, i) => (
            <BlockView key={i} block={it} />
          ))}
        </fieldset>
      )
  }
}
