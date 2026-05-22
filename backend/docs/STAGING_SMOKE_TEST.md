# Staging Smoke Test WaFli

## API y DB

- `GET /health` devuelve `success: true`.
- `GET /health/extended` devuelve `dbMs` y conteos.
- `GET /system/db-info` muestra `database`, `schema`, `username`, `tableCount` y tablas reales.
- `npm run db:init` puede ejecutarse dos veces.

## Worker

- Arranca con `WA_RUNTIME_MODE=worker`.
- Expone solo health HTTP si `WA_WORKER_HEALTH_ENABLED=true`.
- `GET /health` responde en el servicio worker si Easypanel requiere health check.
- Procesa tareas de `whatsapp_runtime_tasks`.

## Datos Demo

- En staging configurar `WFL_ENABLE_SAMPLE_CHATS=false`.
- Si se desplego antes con datos demo activos, limpiar PostgreSQL:

```sql
DELETE FROM message_cache WHERE external_chat_id LIKE 'sample_%';
DELETE FROM conversation_meta WHERE external_chat_id LIKE 'sample_%';
```

## Auth

- `POST /auth/oauth/verify` con Google en staging.
- `GET /auth/me`.
- `POST /auth/refresh`.
- `POST /auth/logout`.

## Onboarding

- `POST /me/legal-acceptance`.
- `PATCH /me/profile`.
- `GET /me/onboarding-status`.

## WhatsApp

- `POST /whatsapp/pairing-code`.
- `GET /whatsapp/status`.
- Confirmar codigo de 8 caracteres.
- Confirmar `connected=true` tras vincular.
- Registrar close codes si falla.

## Frontend

- Build carga desde `dist`.
- `VITE_API_URL` apunta a API staging.
- No usa `frontend/prototipo` en runtime.
- No hay acceso sin sesion ni bypass de staging en runtime.
- Si backend responde cero chats, debe mostrar estado vacio, no `MATCHES`.

## Proveedores

- OpenAI responde y descuenta cuota.
- Stripe checkout test abre URL.
- Webhook duplicado no duplica saldo.
- Push subscribe registra endpoint.
