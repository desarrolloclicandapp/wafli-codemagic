# WaFli iOS readiness

Este checklist deja el proyecto listo para llevarlo a una Mac y generar la version iOS con Capacitor.
Desde Windows ya dejamos preparada la parte web, Android, Firebase Push y Firebase/Google Analytics.
La validacion real de iOS requiere Mac, Xcode y un iPhone fisico.

## Base ya preparada

- Capacitor ya tiene `appId` estable: `com.wafli.app`.
- `package.json` ya incluye `@capacitor/ios`.
- `package.json` ya incluye `@capacitor-firebase/analytics@7.3.1`, compatible con Capacitor 7.
- `package.json` ya incluye `@capacitor/push-notifications`.
- Firebase/Google Analytics ya esta integrado en web y nativo.
- Android ya usa `google-services.json`; iOS necesitara `GoogleService-Info.plist`.
- El frontend detecta `cap-ios`, `cap-android`, `cap-native` y `pwa-standalone` en `<html>`.
- El layout usa variables de safe area: `--safe-top`, `--safe-right`, `--safe-bottom`, `--safe-left`.
- El viewport se sincroniza con `visualViewport` para detectar teclado y evitar que composers/sheets queden tapados.
- Los scrolls internos usan `-webkit-overflow-scrolling: touch`.
- El back nativo de Android no se usa como unica salida: las pantallas profundas mantienen botones visuales de cierre/volver.
- Bottom sheets y modales tienen semantica `dialog`, backdrop accionable y toast con `aria-live`.

## Requisitos en la Mac

1. Instalar Xcode desde App Store.
2. Abrir Xcode una vez y aceptar licencias.
3. Instalar command line tools si Xcode lo pide:

```bash
xcode-select --install
```

4. Tener Node.js LTS instalado.
5. Tener CocoaPods instalado:

```bash
sudo gem install cocoapods
pod --version
```

6. Iniciar sesion en Xcode con Apple ID.
7. Si se va a instalar en iPhone fisico, activar Developer Mode en el iPhone.

## Variables que deben existir en la Mac

Crear `frontend/.env.production` o confirmar que Easypanel/frontend ya tenga estas variables:

```env
VITE_API_URL=https://whatsapp-baileys-wafli-back-api.vz0kcp.easypanel.host
VITE_APP_ENV=production
VITE_PUBLIC_URL=https://app.wafli.ai
VITE_VAPID_PUBLIC_KEY=BCk4ygtk6sONpGzDUHTKWqTc0KqoLtQvBlVkw-FT8g4Yxx_63r1Gcy79MIfvrCfBKy9qJ8Iw_a1IKKeT3AY2oAE
VITE_ALLOW_PREVIEW_FALLBACK=false

VITE_GOOGLE_CLIENT_ID=354075200436-c9qgo0omkg1vcsb3l8u53b9cv88c3la3.apps.googleusercontent.com
VITE_APPLE_CLIENT_ID=
VITE_APPLE_REDIRECT_URI=

VITE_FIREBASE_API_KEY=AIzaSyBAlfVt0zqt3AEre-vE26xh0o_ra91IykY
VITE_FIREBASE_AUTH_DOMAIN=wafli-495617.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=wafli-495617
VITE_FIREBASE_STORAGE_BUCKET=wafli-495617.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=354075200436
VITE_FIREBASE_APP_ID=1:354075200436:web:8b2fec089f720d38ed40e1
VITE_FIREBASE_MEASUREMENT_ID=G-Z4EL2B1ZJJ
```

Nota: estas variables web sirven para la app web. En iOS nativo, Firebase usa principalmente `GoogleService-Info.plist`.

## Firebase iOS antes de abrir Xcode

En Firebase Console:

1. Crear app iOS dentro del proyecto `wafli-495617`.
2. Bundle ID recomendado: `com.wafli.app`.
3. Nombre de app: `WaFli`.
4. Descargar `GoogleService-Info.plist`.
5. Guardarlo temporalmente; despues de `npx cap add ios`, copiarlo a:

```text
frontend/ios/App/App/GoogleService-Info.plist
```

## Google Sign-In para iOS

Para que Google Login funcione como app real en iOS, crear un OAuth Client de tipo iOS en Google Cloud/Firebase:

1. Package/bundle id: `com.wafli.app`.
2. Descargar o revisar el `REVERSED_CLIENT_ID` que venga en `GoogleService-Info.plist`.
3. Agregar el URL Scheme en Xcode:

```text
Targets > App > Info > URL Types > + > URL Schemes
```

Usar el valor `REVERSED_CLIENT_ID`.

Si el plugin de social login requiere config adicional para iOS, hacerlo despues de que Xcode genere el proyecto.

## Apple Sign In

Ahora mismo `capacitor.config.json` tiene Apple desactivado:

```json
"apple": false
```

Para activarlo luego:

1. Tener Apple Developer Program.
2. Activar `Sign In with Apple` en el App ID.
3. Crear Service ID si se usa flujo web.
4. Configurar `VITE_APPLE_CLIENT_ID` y `VITE_APPLE_REDIRECT_URI`.
5. Cambiar `apple` a `true` en `capacitor.config.json`.

No bloquear la primera build iOS por Apple Sign In; primero conviene validar Google, Push y Analytics.

## Comandos en la Mac

```bash
cd frontend
npm install
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

## Codemagic como flujo principal

Ya existe `codemagic.yaml` en la raiz del repositorio con dos workflows:

- `ios-simulator`: build rapido sin firma para detectar errores de iOS/Pods/Xcode.
- `ios-testflight`: build firmado y subida a TestFlight.

Como el frontend vive en `frontend/`, el YAML entra a esa carpeta antes de correr `npm ci`, `npm run build` y `npx cap sync ios`.

### Grupos de variables en Codemagic

Crear estos grupos en Codemagic:

```text
wafli_frontend_prod
wafli_ios_firebase
wafli_ios_signing
```

`wafli_frontend_prod` debe contener las variables `VITE_*` de `envfront.md`.

`wafli_ios_firebase` debe contener:

```text
GOOGLE_SERVICE_INFO_PLIST_BASE64
GOOGLE_REVERSED_CLIENT_ID
```

Para generar el base64 en Mac:

```bash
base64 -i GoogleService-Info.plist | pbcopy
```

Para generarlo desde PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("GoogleService-Info.plist")) | Set-Clipboard
```

`GOOGLE_REVERSED_CLIENT_ID` sale del `GoogleService-Info.plist`.

`wafli_ios_signing` queda vinculado a la integracion App Store Connect de Codemagic.

### App Store Connect API Key

En App Store Connect crear una API key y conectarla en Codemagic:

```text
Users and Access > Integrations > App Store Connect API
```

Codemagic usa esa integracion para descargar/crear certificados y provisioning profiles con:

```bash
app-store-connect fetch-signing-files "$BUNDLE_ID" --type IOS_APP_STORE --create
```

### Orden recomendado

1. Crear la app iOS en Firebase y obtener `GoogleService-Info.plist`.
2. Crear App ID `com.wafli.app` en Apple Developer.
3. Activar capabilities necesarias: Push Notifications y Sign In with Apple si aplica.
4. Crear la app en App Store Connect.
5. Crear App Store Connect API Key.
6. Configurar variables/grupos en Codemagic.
7. Ejecutar primero `ios-simulator`.
8. Ejecutar despues `ios-testflight`.

Si `ios/` ya existe porque se genero antes:

```bash
cd frontend
npm install
npm run build
npx cap sync ios
npx cap open ios
```

## Ajuste obligatorio del Podfile para Firebase Analytics

Despues de `npx cap add ios`, abrir:

```text
frontend/ios/App/Podfile
```

Dentro de:

```ruby
target 'App' do
  capacitor_pods
  # Add your Pods here
end
```

Agregar debajo de `# Add your Pods here`:

```ruby
pod 'CapacitorFirebaseAnalytics/Analytics', :path => '../../node_modules/@capacitor-firebase/analytics'
```

Luego ejecutar:

```bash
cd frontend
npx cap sync ios
```

Si se quiere evitar IDFA/Advertising ID en iOS, usar esta variante:

```ruby
pod 'CapacitorFirebaseAnalytics/AnalyticsWithoutAdIdSupport', :path => '../../node_modules/@capacitor-firebase/analytics'
```

## Push Notifications en iOS

Android ya funciona con FCM. iOS necesita APNs + Firebase:

1. En Apple Developer, crear o confirmar App ID `com.wafli.app`.
2. Activar capability `Push Notifications`.
3. Crear APNs Auth Key.
4. Subir la APNs Auth Key a Firebase Console:

```text
Project settings > Cloud Messaging > Apple app configuration
```

5. En Xcode, activar capabilities:

```text
Signing & Capabilities > + Capability > Push Notifications
Signing & Capabilities > + Capability > Background Modes > Remote notifications
```

6. Probar en iPhone fisico. Push no se valida bien solo con simulador.

## Analytics en iOS

Ya esta instrumentado en el frontend:

- `app_open`
- `screen_view`
- `login_success`
- `ai_action_requested`
- `ai_action_completed`
- `ai_action_failed`
- `checkout_started`
- `whatsapp_connected`
- `notification_permission_granted`

Para DebugView en iOS, usar Xcode y agregar argumento de lanzamiento:

```text
-FIRDebugEnabled
```

Luego abrir:

```text
Firebase Console > Analytics > DebugView
```

## Pantallas que hay que probar en iPhone

- Login con Google/Apple.
- Chats con lista larga.
- Chat detalle con teclado abierto.
- Composer con texto largo.
- Sugerir respuesta con teclado abierto.
- Reactivar hilo con teclado abierto.
- Reescribir texto.
- Analisis de mensaje.
- Plan e historial de uso.
- Ajustes.
- Perfil, incluyendo scroll y Guardar.
- Notificaciones.
- Soporte, sin abrir accidentalmente otras apps.
- Terminos legales y vuelta a Ajustes.

## Criterios iOS

- Nada importante queda debajo del home indicator.
- Header respeta notch/Dynamic Island.
- Bottom nav tiene padding inferior suficiente.
- Cada pantalla tiene un unico scroll principal claro.
- Los bottom sheets bloquean el scroll de fondo.
- Inputs enfocados quedan visibles sobre el teclado.
- Los botones tactiles tienen al menos 44px de alto.
- No hay zoom automatico al enfocar inputs.
- Animaciones son suaves, cortas y respetan `prefers-reduced-motion`.

## Comandos utiles de mantenimiento

```bash
cd frontend
npm run build
npx cap copy ios
npx cap sync ios
npx cap open ios
```

Si CocoaPods queda raro:

```bash
cd frontend/ios/App
pod install --repo-update
```

## Pendientes especificos antes de publicar en App Store

- Crear proyecto `ios/` con `npx cap add ios` en Mac.
- Copiar `GoogleService-Info.plist`.
- Configurar Team y Signing en Xcode.
- Configurar Push Notifications con Apple Developer + APNs + Firebase.
- Definir iconos y splash screen iOS.
- Configurar Apple Sign In si se quiere login nativo Apple.
- Revisar `Info.plist` para permisos que se agreguen despues.
- Revisar Status Bar con `@capacitor/status-bar` si hace falta ajuste visual.
- Preparar privacy nutrition labels en App Store Connect.
- Revisar politica de datos de Google Analytics/Firebase.

## Riesgos conocidos en Capacitor iOS

- `100vh` puede comportarse mal con teclado y barras dinamicas; preferir las variables ya expuestas.
- Inputs dentro de bottom sheets requieren prueba real con teclado.
- `position: fixed` puede necesitar ajustes finos en `WKWebView`.
- El simulador no representa todas las condiciones de teclado, notch, memoria y permisos.
