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

## Base de datos y usuarios (Supabase)

La app usa Supabase para autenticación, perfiles y almacenamiento de los informes. Los informes se
guardan primero en el dispositivo (funciona sin conexión) y se sincronizan con el servidor.

- `supabase/migrations/20261104_01_esquema_inicial.sql`: tablas `perfiles`, `informes`,
  `consecutivos`, código único `ITS-AAAA-NNNN` (trigger), políticas de seguridad (RLS) y la función
  `reasignar_informe`.
- `supabase/functions/admin-users`: función Edge que usa el administrador para crear usuarios,
  restablecer contraseñas y activar o desactivar cuentas.

### Puesta en marcha

1. Ejecutar la migración en el SQL Editor del proyecto (o `supabase db push`).
2. Desplegar la función: `supabase functions deploy admin-users` (usa las variables que Supabase
   inyecta automáticamente: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Crear el primer administrador en **Authentication → Users → Add user** (correo, contraseña y
   "Auto confirm"). El perfil se crea solo; luego, en el SQL Editor:
   ```sql
   update public.perfiles set rol = 'admin' where correo = 'correo@del.admin';
   ```
4. Copiar `.env.example` a `.env` con la URL del proyecto y la clave pública (anon / publishable),
   y configurar las mismas variables en Vercel.

### Roles

- **Administrador:** crea profesionales (con contraseña temporal que deben cambiar al ingresar),
  los desactiva o reactiva, restablece contraseñas, ve todos los informes y puede reasignarlos.
  También puede elaborar sus propios informes.
- **Profesional:** ve y edita únicamente sus informes.

## Despliegue en Vercel

1. Importar este repositorio en Vercel.
2. Framework: **Vite** (se detecta automáticamente; `vercel.json` ya define build y salida `dist`).
3. Variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Desplegar.

Tras el despliegue, abrir la URL en el celular o tablet y usar **"Agregar a pantalla de inicio"**
para instalarla como aplicación.

## Licencia

Uso institucional. Comisaría de Familia, Municipio de Morales (Cauca).
