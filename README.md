# WaFli clean Codemagic repo

Este repo limpio contiene solo lo necesario para trabajar frontend/backend y compilar iOS con Codemagic.

Incluye:
- frontend/
- backend/
- codemagic.yaml
- envfront.md
- envapi.md
- envworker.md

Excluye intencionalmente:
- node_modules/
- dist/ y builds generados
- .env y .env.production
- frontend/android/keystore.properties
- *.jks, *.keystore, *.p8, *.p12, *.mobileprovision
- GoogleService-Info.plist

Para Codemagic:
- Conecta este repo completo.
- Ejecuta primero el workflow ios-simulator.
- Configura los grupos wafli_frontend_prod y wafli_ios_firebase.

Para Easypanel:
- API y worker pueden seguir desplegados desde tu flujo actual.
- Esta repo no necesita desplegar backend desde Codemagic.
