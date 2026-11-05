/** Utilidades de imagen para el generador Word (sin depender del navegador). */

export type TipoImagen = 'png' | 'jpg'

export interface ImagenBytes {
  bytes: Uint8Array
  type: TipoImagen
  width: number
  height: number
}

/** Lee ancho y alto de un PNG o JPEG a partir de sus cabeceras. */
export function dimensiones(bytes: Uint8Array): { type: TipoImagen; width: number; height: number } | undefined {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // PNG: firma + IHDR
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { type: 'png', width: dv.getUint32(16), height: dv.getUint32(20) }
  }
  // JPEG: buscar el marcador SOF
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++
        continue
      }
      const marker = bytes[i + 1]
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2
        continue
      }
      const len = dv.getUint16(i + 2)
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { type: 'jpg', height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) }
      }
      i += 2 + len
    }
  }
  return undefined
}

export function desdeBytes(bytes: Uint8Array | undefined): ImagenBytes | undefined {
  if (!bytes) return undefined
  const d = dimensiones(bytes)
  return d ? { bytes, ...d } : undefined
}

export function desdeDataUrl(dataUrl: string): ImagenBytes | undefined {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(dataUrl)
  if (!m) return undefined
  const bin = atob(m[2])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return desdeBytes(bytes)
}

/** Tamaño en píxeles (a 96 ppp, como usa Word) que cabe en la caja indicada, manteniendo proporción. */
export function ajustar(img: ImagenBytes, maxW: number, maxH: number): { width: number; height: number } {
  const s = Math.min(maxW / img.width, maxH / img.height)
  return { width: Math.round(img.width * s), height: Math.round(img.height * s) }
}
