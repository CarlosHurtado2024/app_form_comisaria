# PWA "Informe Trabajo Social" — Diseño

Fecha: 2026-11-04

## Propósito

Facilitar a la profesional de Trabajo Social de la Comisaría de Familia (Municipio de Morales, Cauca)
el diligenciamiento del **Formato Informe de Valoración Sociofamiliar de Verificación de Derechos**
(Cód. F-PM-096, versión 11, 8 páginas) desde celular, tablet o PC, y generar automáticamente el PDF
con el mismo formato institucional, incluyendo los datos de quien elabora y su firma.

Formato de referencia: `docs/Formato_original_F-PM-096.pdf`.

## Alcance

- Aplicación web progresiva (instalable, funciona sin conexión) desplegable en Vercel como sitio estático.
- Sin backend: los informes y el perfil del profesional se guardan en el dispositivo (`localStorage`).
- Un perfil de profesional reutilizable: nombre, tarjeta profesional, sección, cargo, "dirigido a" por
  defecto y firma (dibujada en pantalla o cargada como imagen).
- Varios informes guardados; cada uno se edita por secciones con autoguardado.
- Generación del PDF en el navegador con `pdf-lib`, reproduciendo encabezado, barras de sección,
  casillas de verificación, tablas y campo de firma del formato original.

## Arquitectura

- Vite + React 19 + TypeScript. Estilos propios con variables CSS (sin framework de UI).
- `vite-plugin-pwa` (Workbox) para manifest, service worker y caché offline.
- El formulario se describe una sola vez como **esquema declarativo** (`src/form/schema.ts`):
  secciones → bloques (texto, fecha, área de texto, radio, casillas, sí/no con descripción, tabla, fila).
  El mismo esquema alimenta la interfaz de captura y el generador de PDF, así ambos se mantienen alineados.
- `src/pdf/`: motor de maquetación por flujo (encabezado por página, salto de página, ajuste de texto,
  casillas dibujadas con vectores) + ensamblado del documento.
- `src/store/`: persistencia de informes y perfil en `localStorage`.
- Pantallas: Inicio (lista de informes), Perfil del profesional, Editor del informe (pasos por sección,
  navegación lateral en escritorio y barra de pasos en móvil), acción "Generar PDF".

## Decisiones

- Fuente Helvetica estándar de PDF (WinAnsi) cubre tildes y ñ sin incrustar tipografías.
- Las casillas se dibujan como rectángulos con marca vectorial; no se usan glifos especiales.
- Los textos largos (síntesis, concepto, análisis) fluyen y se parten entre páginas; los bloques
  compuestos (filas de casillas, tablas) no se parten: si no caben, pasan a la página siguiente.
- La firma se incrusta como PNG en la sección 9 junto al nombre y la tarjeta profesional.

## Pruebas

- Pruebas unitarias (Vitest) del almacenamiento y del generador de PDF (el documento se genera sin
  error y tiene al menos las páginas esperadas con datos de ejemplo).
- Verificación manual en el navegador con vistas móvil, tablet y escritorio.
