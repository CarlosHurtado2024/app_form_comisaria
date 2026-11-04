import escudoUrl from '../assets/escudo.png'
import pdetUrl from '../assets/pdet.png'
import { asString, type FormData } from '../form/types'
import type { Profile } from '../store/storage'
import { generatePdf, type PdfAssets } from './generate'

let assetsPromise: Promise<PdfAssets> | undefined

async function fetchBytes(url: string): Promise<Uint8Array | undefined> {
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return undefined
  }
}

function loadAssets(): Promise<PdfAssets> {
  assetsPromise ??= Promise.all([fetchBytes(escudoUrl), fetchBytes(pdetUrl)]).then(([escudo, pdet]) => ({ escudo, pdet }))
  return assetsPromise
}

export function pdfFileName(data: FormData): string {
  const nna = `${asString(data.nombres)} ${asString(data.apellidos)}`
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  const fecha = asString(data.fecha_elaboracion) || new Date().toISOString().slice(0, 10)
  return `Informe_Trabajo_Social_${nna || 'NNA'}_${fecha}.pdf`
}

export async function buildPdfBlob(data: FormData, profile: Profile): Promise<Blob> {
  const assets = await loadAssets()
  const bytes = await generatePdf({ data, profile, assets })
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/** Descarga el PDF (o lo comparte en móviles que lo permiten). Devuelve el modo usado. */
export async function downloadPdf(data: FormData, profile: Profile, mode: 'download' | 'share' | 'open' = 'download'): Promise<string> {
  const blob = await buildPdfBlob(data, profile)
  const name = pdfFileName(data)
  const file = new File([blob], name, { type: 'application/pdf' })

  if (mode === 'share' && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name })
    return 'share'
  }
  const url = URL.createObjectURL(blob)
  if (mode === 'open') {
    const win = window.open(url, '_blank')
    if (win) {
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return 'open'
    }
  }
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'download'
}

export const canShareFiles = (): boolean => typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
