# WhatsApp Pairing Validation

## Estado tecnico confirmado

- Version instalada: `@whiskeysockets/baileys` desde `backend/vendor/baileys/baileys-7.0.0-rc.9.tgz`.
- API exacta disponible:
  - `sock.requestPairingCode(phoneNumber, customPairingCode?)`
  - `phoneNumber` debe ir solo con digitos y codigo de pais, sin `+`, espacios, guiones ni parentesis.
  - `customPairingCode` es opcional.
  - Si se envia `customPairingCode`, Baileys exige exactamente 8 caracteres.
  - Si no se envia custom code, Baileys genera internamente un codigo de 8 caracteres.
- Referencia local validada:
  - `backend/node_modules/@whiskeysockets/baileys/lib/Socket/socket.js`
  - `backend/node_modules/@whiskeysockets/baileys/lib/Socket/index.d.ts`
  - `backend/node_modules/@whiskeysockets/baileys/README.md`

## Implicacion de producto

El onboarding debe tratar el pairing code como codigo de 8 caracteres. No debemos disenar el flujo asumiendo 6 caracteres para WhatsApp, aunque OTP de login si puede seguir siendo de 6 digitos.

## Flujo backend implementado

1. API recibe `POST /whatsapp/pairing-code`.
2. En modo `combined`, API ejecuta Baileys directamente.
3. En modo `api`, API encola una tarea `pairing_code` en PostgreSQL y devuelve `202`.
4. El proceso `worker` toma la tarea, crea/usa la sesion `user_${userId}` y llama `sock.requestPairingCode(...)`.
5. El codigo queda persistido en `whatsapp_connections.pairing_code`.
6. El frontend debe consultar `GET /whatsapp/status` hasta ver `status = pairing_code` o `connected`.

## Checklist de prueba con telefono real

- iOS:
  - Probar numero propio con WhatsApp actualizado.
  - Validar ruta exacta en app: Dispositivos vinculados -> Vincular dispositivo -> Vincular con numero de telefono.
  - Medir tiempo desde request backend hasta codigo visible.
  - Medir si el codigo de 8 caracteres es aceptado.
  - Confirmar evento backend `connection=open`.
  - Guardar close code si falla.

- Android:
  - Probar numero propio con WhatsApp actualizado.
  - Validar ruta exacta en app: Dispositivos vinculados -> Vincular dispositivo -> Vincular con numero de telefono.
  - Medir tiempo desde request backend hasta codigo visible.
  - Medir si el codigo de 8 caracteres es aceptado.
  - Confirmar evento backend `connection=open`.
  - Guardar close code si falla.

## Criterio para desbloquear onboarding

El onboarding visual no queda cerrado hasta tener:

- 3 enlaces exitosos consecutivos en iOS.
- 3 enlaces exitosos consecutivos en Android.
- Registro de tasa de exito del flujo.
- Tutorial revisado contra la version actual de WhatsApp en ambos sistemas.
- Confirmacion operativa con Luis sobre diferencias frente al backend Baileys actual.
