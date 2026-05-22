# Frontend WaFli

App productiva (Vite + React) que renderiza fielmente las pantallas
móviles del prototipo. La maqueta original queda como referencia en
[`prototipo/`](./prototipo/) y no se importa en runtime.

## Estructura

```
frontend/
|-- index.html             # Entry Vite
|-- vite.config.js         # Config Vite + React plugin
|-- package.json           # Dependencias y scripts
|-- src/
|   |-- main.jsx           # Bootstrap: importa pantallas en orden y monta <App />
|   |-- App.jsx            # Wrapper productivo (renderiza el .phone fullscreen)
|   |-- styles.css         # Tokens del prototipo + overlay productivo (responsive)
|   `-- screens/           # Pantallas migradas 1:1 desde prototipo
|       |-- icons.jsx      #   set Lucide-style -> window.Icons
|       |-- shared.jsx     #   Avatar, BottomSheet, FullModal, Toast, BottomNav...
|       |-- screens.jsx    #   Landing, Auth, Legal, Chats, Chat, Plan, Settings, sheets...
|       `-- app.jsx        #   WaFliApp + Phone + RuntimeErrorBoundary
`-- prototipo/             # Maqueta original (HTML+Babel-standalone). NO se importa.
    |-- WaFli.html
    |-- design-canvas.jsx
    |-- tweaks-panel.jsx
    |-- styles/wafli.css
    |-- app/{app,screens,shared,data,icons}.jsx
    `-- mosq6aa9-spec-pantallas.md
```

## Comandos

```bash
npm install
npm run dev      # http://localhost:5173 (abre el navegador)
npm run build    # genera dist/
npm run preview  # sirve dist/ para verificación local
```

## Variables

```bash
VITE_API_URL=http://localhost:3001
VITE_APP_ENV=local
VITE_PUBLIC_URL=http://localhost:5173
VITE_VAPID_PUBLIC_KEY=
VITE_GOOGLE_CLIENT_ID=
VITE_APPLE_CLIENT_ID=
VITE_APPLE_REDIRECT_URI=
VITE_ALLOW_PREVIEW_FALLBACK=false
```

## Integracion backend

La capa API vive en `src/api/` y se expone como `window.WaFliAPI` para convivir con la estructura heredada del prototipo. En staging no hay fallback local ni acceso al panel sin sesion validada por backend.

Para Easypanel, ver `../DEPLOY_EASYPANEL.md`.

## Docker

La imagen se construye desde `frontend/Dockerfile`, compila Vite y sirve `dist/` con Nginx.

```bash
docker build \
  --build-arg VITE_API_URL=https://api-staging.tudominio.com \
  --build-arg VITE_APP_ENV=staging \
  --build-arg VITE_PUBLIC_URL=https://app-staging.tudominio.com \
  --build-arg VITE_VAPID_PUBLIC_KEY= \
  --build-arg VITE_GOOGLE_CLIENT_ID=google-client-id.apps.googleusercontent.com \
  --build-arg VITE_APPLE_CLIENT_ID= \
  --build-arg VITE_APPLE_REDIRECT_URI= \
  -t wafli-frontend:staging .
```

Las variables `VITE_*` quedan embebidas en el build, asi que en Easypanel deben configurarse antes de compilar la imagen.

## Decisiones de runtime

- **Cobertura**: las 16 pantallas/sheets del prototipo navegable están vivas en
  producción (Landing, Auth, Legal, SpanishVariant, ToneBase, Connect, Connected,
  AddToHome, ChatsList, Chat, Suggest, Opener, Rewrite, Analysis, Plan, Quota,
  Settings, billing).
- **Mobile-first**: en pantallas ≤768 px el wrapper `.phone` ocupa el viewport
  completo (100dvh) y se oculta la barra falsa de iOS; en desktop queda
  centrado como preview 390×780 sobre fondo neutro.
- **Sin chrome de prototipo**: no se incluyen `design-canvas.jsx` ni
  `tweaks-panel.jsx` (eran herramientas de diseño, no parte de la app).
- **Globals controlados**: cada módulo de `screens/` expone sus símbolos en
  `window` (`window.Icons`, `window.WaFliApp`, etc.) y los
  consume vía un destructure al inicio. Es el patrón más fiel al prototipo y
  evita reescribir 2 000+ líneas a imports/exports. Convertir a módulos ESM
  estrictos es un refactor posterior si se busca tree-shaking.

## Recuperación UTF-8

Los archivos del prototipo llegaron con doble mojibake (UTF-8->cp1252->UTF-8).
Se recuperaron mediante reemplazo por patrón antes de copiarse a `src/screens/`.
La maqueta en `prototipo/` se conserva tal cual la entregó el cliente.
