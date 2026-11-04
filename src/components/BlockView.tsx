import { useId } from 'react'
import {
  asList,
  asRows,
  asString,
  type Block,
  type ChecksBlock,
  type RadioBlock,
  type TableBlock,
  type TableRow,
  type YesNoBlock,
} from '../form/types'
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

function TextField({ block }: { block: Extract<Block, { type: 'text' }> }) {
  const { data, set } = useForm()
  const id = useId()
  return (
    <div className="field">
      <Label id={id} text={block.label} />
      <input
        id={id}
        className="input"
        type={block.inputType ?? 'text'}
        inputMode={block.inputType === 'number' ? 'numeric' : undefined}
        placeholder={block.placeholder}
        value={asString(data[block.key])}
        onChange={(e) => set(block.key, e.target.value)}
        aria-label={block.label || undefined}
      />
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
      <textarea
        id={id}
        className="textarea"
        rows={Math.max(2, Math.min(block.rows ?? 4, 12))}
        value={asString(data[block.key])}
        onChange={(e) => set(block.key, e.target.value)}
        aria-label={block.label || 'Texto'}
      />
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
      <div className="seg" role="radiogroup" aria-label={block.label}>
        {(['No', 'Sí'] as const).map((o) => (
          <button type="button" key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => set(block.key, value === o ? '' : o)}>
            {o}
          </button>
        ))}
      </div>
      {textLabel && (
        <>
          <label className="field__hint" htmlFor={id}>
            {textLabel}
          </label>
          <textarea id={id} className="textarea" rows={3} value={asString(data[textKey])} onChange={(e) => set(textKey, e.target.value)} />
        </>
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
  const weights = block.columns.map((c) => `${c.width ?? 1}fr`).join(' ')
  const rowName = block.rowName ?? 'Fila'
  return (
    <div className="field">
      {block.label && <span className="field__label">{block.label}</span>}
      <div className="tbl tbl--wide" style={{ '--tbl-cols': `70px ${weights} 44px` } as React.CSSProperties}>
        <div className="tbl__head" aria-hidden="true">
          <span>#</span>
          {block.columns.map((c) => (
            <span key={c.key}>{c.label}</span>
          ))}
          <span />
        </div>
        {shown.map((row, i) => (
          <div className="tbl__row" key={i}>
            <span className="tbl__rowname">
              {rowName} {i + 1}
            </span>
            {block.columns.map((c) => (
              <div className="tbl__cell" key={c.key}>
                <span>{c.label}</span>
                {c.type === 'radio' && c.options ? (
                  <div className="seg" role="radiogroup" aria-label={`${c.label} ${rowName} ${i + 1}`}>
                    {c.options.map((o) => (
                      <button type="button" key={o} role="radio" aria-checked={row[c.key] === o} className={row[c.key] === o ? 'on' : ''} onClick={() => update(i, c.key, row[c.key] === o ? '' : o)}>
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
                    value={row[c.key] ?? ''}
                    onChange={(e) => update(i, c.key, e.target.value)}
                  />
                )}
              </div>
            ))}
            <div className="tbl__actions">
              <button type="button" className="btn btn--danger btn--sm btn--icon" aria-label={`Eliminar ${rowName} ${i + 1}`} onClick={() => remove(i)} disabled={shown.length === 1 && Object.keys(row).length === 0}>
                ✕
              </button>
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
  switch (block.type) {
    case 'text':
      return <TextField block={block} />
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
    case 'row':
      return (
        <div className="f-row" style={{ '--cols': Math.min(block.items.length, 4) } as React.CSSProperties}>
          {block.items.map((it, i) => (
            <BlockView key={i} block={it} />
          ))}
        </div>
      )
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
