import { useEffect, useRef, useState } from 'react'
import SignaturePadLib from 'signature_pad'

interface Props {
  value?: string
  onChange: (dataUrl: string | undefined) => void
}

/** Convierte cualquier imagen a PNG (fondo transparente si lo tiene) limitando su tamaño. */
async function fileToPng(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('No se pudo leer la imagen'))
      i.src = url
    })
    const max = 900
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Recorta el lienzo al trazo dibujado para que la firma ocupe bien el espacio en el PDF. */
function trimCanvas(src: HTMLCanvasElement): string {
  const ctx = src.getContext('2d')!
  const { width, height } = src
  const px = ctx.getImageData(0, 0, width, height).data
  let top = height, left = width, right = 0, bottom = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] > 10) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right < left) return src.toDataURL('image/png')
  const pad = 8
  const out = document.createElement('canvas')
  out.width = right - left + 1 + pad * 2
  out.height = bottom - top + 1 + pad * 2
  out.getContext('2d')!.drawImage(src, left, top, right - left + 1, bottom - top + 1, pad, pad, right - left + 1, bottom - top + 1)
  return out.toDataURL('image/png')
}

export function SignaturePad({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)
  const [drawing, setDrawing] = useState(!value)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!drawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const pad = new SignaturePadLib(canvas, { penColor: '#111', minWidth: 0.8, maxWidth: 2.2, throttle: 8 })
    padRef.current = pad
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const data = pad.toData()
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d')!.scale(ratio, ratio)
      pad.clear()
      pad.fromData(data)
    }
    resize()
    const onEnd = () => setDirty(!pad.isEmpty())
    pad.addEventListener('endStroke', onEnd)
    window.addEventListener('resize', resize)
    return () => {
      pad.removeEventListener('endStroke', onEnd)
      window.removeEventListener('resize', resize)
      pad.off()
      padRef.current = null
    }
  }, [drawing])

  const save = () => {
    const pad = padRef.current
    const canvas = canvasRef.current
    if (!pad || !canvas || pad.isEmpty()) return
    onChange(trimCanvas(canvas))
    setDrawing(false)
    setDirty(false)
  }

  const clear = () => {
    padRef.current?.clear()
    setDirty(false)
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      onChange(await fileToPng(file))
      setDrawing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la imagen')
    }
  }

  return (
    <div className="sig">
      {drawing ? (
        <>
          <div className="sig__canvas">
            <canvas ref={canvasRef} aria-label="Área para dibujar la firma" />
            <div className="sig__line" />
          </div>
          <span className="field__hint">Dibuje la firma con el dedo, lápiz o ratón. En tablet y celular puede girar el dispositivo para tener más espacio.</span>
          <div className="sig__actions">
            <button type="button" className="btn btn--primary" onClick={save} disabled={!dirty}>
              Guardar firma
            </button>
            <button type="button" className="btn btn--ghost" onClick={clear}>
              Limpiar
            </button>
            {value && (
              <button type="button" className="btn btn--ghost" onClick={() => setDrawing(false)}>
                Cancelar
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="sig__preview">{value ? <img src={value} alt="Firma del profesional" /> : <span className="field__hint">Sin firma registrada</span>}</div>
          <div className="sig__actions">
            <button type="button" className="btn btn--primary" onClick={() => setDrawing(true)}>
              {value ? 'Dibujar de nuevo' : 'Dibujar firma'}
            </button>
            {value && (
              <button type="button" className="btn btn--danger" onClick={() => onChange(undefined)}>
                Quitar firma
              </button>
            )}
          </div>
        </>
      )}
      <div className="sig__actions">
        <label className="btn btn--ghost">
          Subir imagen de la firma
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        <span className="field__hint">PNG con fondo transparente o foto de la firma sobre papel blanco.</span>
      </div>
      {error && <span className="field__hint" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}
