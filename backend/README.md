# WaFli Backend

Backend V0 para WaFli. Esta implementacion arranca limpia en `backend` y reutiliza patrones operativos de `externo/whatsapp-automation` sin arrastrar su modelo B2B multi-tenant.

## Comandos

```bash
npm install
npm run db:init
npm run dev
npm run dev:api
npm run dev:worker
npm test
```

## Stack

- Node.js 20
- Express 5
- PostgreSQL con `pg`
- CommonJS
- Baileys opcional para runtime WhatsApp
- OpenAI server-side
- Stripe Checkout y webhooks
- Web Push

## Runtime

El backend soporta tres modos:

- `combined`: API, jobs y runtime WhatsApp en un mismo proceso.
- `api`: expone HTTP, pero no abre sockets Baileys; encola comandos en PostgreSQL.
- `worker`: no expone HTTP; procesa jobs locales y tareas WhatsApp.

Para separar procesos:

```bash
npm run dev:api
npm run dev:worker
```

La API y el worker se coordinan mediante `whatsapp_runtime_tasks`. Esto evita Redis en V0 y deja un corte limpio para mover la cola a Redis/BullMQ mas adelante si hace falta.

## Pairing WhatsApp

La validacion tecnica del pairing code queda documentada en `docs/WHATSAPP_PAIRING_VALIDATION.md`.

## Deploy Staging

La guia de despliegue en Easypanel vive en `../DEPLOY_EASYPANEL.md`.
El smoke test operativo vive en `docs/STAGING_SMOKE_TEST.md`.

## Docker

La imagen se construye desde `backend/Dockerfile` y sirve tanto para API como para worker.
En Docker/Easypanel escucha por defecto en el puerto interno `80`.

```bash
docker build -t wafli-backend:staging .
```

Comando de arranque esperado por Docker/Easypanel:

```bash
node src/index.js
```

El modo real lo decide `WA_RUNTIME_MODE`: `api`, `worker` o `combined`.

La dependencia local de WhatsApp esta vendorizada en `vendor/baileys/` para que el repo backend compile solo, sin depender de `../externo`.
