# Informe Trabajo Social · Comisaría de Familia (PWA)

Aplicación web progresiva para diligenciar el **Formato Informe de Valoración Sociofamiliar de
Verificación de Derechos** (Cód. F-PM-096, versión 11, Alcaldía Municipal de Morales, Cauca) desde
celular, tablet o computador, y generar automáticamente el PDF con el formato institucional,
incluyendo los datos del profesional que lo elabora y su firma.

## Características

- **Funciona en cualquier dispositivo**: diseño adaptable para móvil, tablet y escritorio.
- **Instalable y sin conexión**: PWA con service worker; una vez abierta, funciona sin internet.
- **Diligenciamiento por secciones** (las 9 del formato) con autoguardado en el dispositivo.
- **Perfil del profesional** reutilizable: nombre, tarjeta profesional, sección, cargo y **firma**
  (dibujada en pantalla o cargada como imagen). Se prellena en cada informe nuevo.
- **Generación del PDF** en el navegador, sin servidor, de dos formas:
  - **Generar PDF** (recomendado): abre el informe en HTML con el formato institucional completo
    (misma plantilla que el generador con Chrome headless) y usa el motor de impresión del navegador
    ("Guardar como PDF"). Resultado vectorial, con encabezado y "Página X de N" en cada hoja.
  - **Descarga directa**: construye el PDF con `pdf-lib` sin pasar por el cuadro de impresión.
    Útil para compartir desde el celular (WhatsApp, correo).
- **Varios informes** guardados, con duplicado y eliminación.
- Sin backend: toda la información queda únicamente en el dispositivo (`localStorage`).

## Estructura

```
src/
  form/schema.ts      Esquema declarativo del formulario (alimenta la interfaz y el PDF)
  form/types.ts       Tipos de bloques y utilidades
  pdf/engine.ts       Motor de maquetación (cursor, ajuste de texto, casillas, encabezado)
  pdf/blocks.ts       Medición y dibujo de cada tipo de bloque
  pdf/generate.ts     Ensamblado del documento y bloque de firma
  pdf/download.ts     Descarga / compartir en el navegador
  pdf/html.ts         Plantilla HTML del formato (paginación y encabezado por página)
  pdf/print.ts        Abre la plantilla HTML lista para "Guardar como PDF"
  store/storage.ts    Persistencia de perfil e informes
  components/         Renderizado de bloques, firma, barra superior, avisos
  screens/            Inicio, Perfil, Editor
docs/Formato_original_F-PM-096.pdf   Formato de referencia
```

## Desarrollo

```bash
npm install
npm run dev
```

Pruebas y compilación:

```bash
npm test
npm run build
```

## Despliegue en Vercel

1. Importar este repositorio en Vercel.
2. Framework: **Vite** (se detecta automáticamente; `vercel.json` ya define build y salida `dist`).
3. Desplegar. No se requieren variables de entorno.

Tras el despliegue, abrir la URL en el celular o tablet y usar **"Agregar a pantalla de inicio"**
para instalarla como aplicación.

## Licencia

Uso institucional. Comisaría de Familia, Municipio de Morales (Cauca).
