import escudoUrl from '../assets/escudo.png'
import pdetUrl from '../assets/pdet.png'
import pieUrl from '../assets/pie.png'
import type { FormData } from '../form/types'
import { pdfFileName } from '../pdf/download'
import type { Profile } from '../store/storage'
import type { DocxAssets } from './generate'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

let assetsPromise: Promise<DocxAssets> | undefined

async function fetchBytes(url: string): Promise<Uint8Array | undefined> {
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return undefined
  }
}

function loadAssets(): Promise<DocxAssets> {
  assetsPromise ??= Promise.all([fetchBytes(escudoUrl), fetchBytes(pdetUrl), fetchBytes(pieUrl)]).then(([escudo, pdet, pie]) => ({ escudo, pdet, pie }))
  return assetsPromise
}

export const docxFileName = (data: FormData): string => pdfFileName(data).replace(/\.pdf$/, '.docx')

/** Genera el informe en Word; la librería se carga solo cuando se usa. */
export async function buildDocxBlob(data: FormData, profile: Profile): Promise<Blob> {
  const [{ generateDocx }, assets] = await Promise.all([import('./generate'), loadAssets()])
  return generateDocx({ data, profile, assets })
}

/** Descarga el Word (o lo comparte en móviles que lo permiten). Devuelve el modo usado. */
export async function downloadDocx(data: FormData, profile: Profile, mode: 'download' | 'share' = 'download'): Promise<string> {
  const blob = await buildDocxBlob(data, profile)
  const name = docxFileName(data)
  const file = new File([blob], name, { type: DOCX_MIME })
  if (mode === 'share' && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name })
    return 'share'
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'download'
}
