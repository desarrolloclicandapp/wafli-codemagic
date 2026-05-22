# iOS native templates

Estos archivos se copian despues de crear `frontend/ios` en la Mac.

## Privacy manifest

Copiar:

```bash
cp frontend/native-templates/ios/PrivacyInfo.xcprivacy frontend/ios/App/App/PrivacyInfo.xcprivacy
```

Luego abrir Xcode y confirmar que el archivo queda incluido en el target `App`.

## GoogleService-Info.plist

El archivo se descarga desde Firebase Console y se coloca en:

```text
frontend/ios/App/App/GoogleService-Info.plist
```

No hay un placeholder versionado porque Firebase genera valores especificos de la app iOS.
