#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$ROOT_DIR/ios"
PODFILE="$IOS_DIR/App/Podfile"
ICON_SOURCE="$ROOT_DIR/resources/icon.png"
APPICON_DIR="$IOS_DIR/App/App/Assets.xcassets/AppIcon.appiconset"
APP_DIR="$IOS_DIR/App/App"
DIST_DIR="$ROOT_DIR/dist"
PUBLIC_DIR="$APP_DIR/public"
INFO_PLIST="$IOS_DIR/App/App/Info.plist"
GOOGLE_SERVICE_PLIST="$IOS_DIR/App/App/GoogleService-Info.plist"
PRIVACY_MANIFEST_SOURCE="$ROOT_DIR/native-templates/ios/PrivacyInfo.xcprivacy"
PRIVACY_MANIFEST_PLIST="$IOS_DIR/App/App/PrivacyInfo.xcprivacy"
ENTITLEMENTS_PLIST="$IOS_DIR/App/App/App.entitlements"
XCODEPROJ="$IOS_DIR/App/App.xcodeproj"
CAP_CONFIG_SOURCE="$ROOT_DIR/capacitor.config.json"
CAP_CONFIG_TARGET="$APP_DIR/capacitor.config.json"
CONFIG_XML_TARGET="$APP_DIR/config.xml"

if [ ! -d "$IOS_DIR" ]; then
  echo "Missing frontend/ios. Run: npx cap add ios"
  exit 1
fi

if [ ! -f "$PODFILE" ]; then
  echo "Missing $PODFILE. Capacitor iOS platform was not generated correctly."
  exit 1
fi

mkdir -p "$APP_DIR"

if [ ! -d "$PUBLIC_DIR" ]; then
  if [ ! -d "$DIST_DIR" ]; then
    echo "Missing $PUBLIC_DIR and $DIST_DIR. Run npm run build before preparing iOS."
    exit 1
  fi
  mkdir -p "$PUBLIC_DIR"
  rsync -a --delete "$DIST_DIR"/ "$PUBLIC_DIR"/
fi

if [ ! -f "$CAP_CONFIG_TARGET" ]; then
  cp "$CAP_CONFIG_SOURCE" "$CAP_CONFIG_TARGET"
fi

if [ ! -f "$CONFIG_XML_TARGET" ]; then
  cat > "$CONFIG_XML_TARGET" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" id="com.wafli.app" version="1.0.0">
  <name>WaFli</name>
  <access origin="*" />
</widget>
XML
fi

ANALYTICS_SWIFT="$ROOT_DIR/node_modules/@capacitor-firebase/analytics/ios/Plugin/FirebaseAnalytics.swift"

if [ -f "$ANALYTICS_SWIFT" ] && grep -q "Analytics.initiateOnDeviceConversionMeasurement" "$ANALYTICS_SWIFT"; then
  ANALYTICS_SWIFT_PATH="$ANALYTICS_SWIFT" ruby <<'RUBY'
path = ENV.fetch('ANALYTICS_SWIFT_PATH')
source = File.read(path)

replacements = {
  <<~'SWIFT' => <<~'SWIFT'
    @objc public func initiateOnDeviceConversionMeasurement(email: String) {
        Analytics.initiateOnDeviceConversionMeasurement(emailAddress: email)
    }
  SWIFT
    @objc public func initiateOnDeviceConversionMeasurement(email: String) {
        // WaFli uses Firebase Analytics without IDFA support. On-device conversion
        // APIs require an extra Google measurement module that is intentionally not
        // included in the no-IDFA pod variant, so keep this optional API as a no-op.
    }
  SWIFT
  ,
  <<~'SWIFT' => <<~'SWIFT'
    @objc public func initiateOnDeviceConversionMeasurement(phone: String) {
        Analytics.initiateOnDeviceConversionMeasurement(phoneNumber: phone)
    }
  SWIFT
    @objc public func initiateOnDeviceConversionMeasurement(phone: String) {
        // No-op for the no-IDFA Analytics pod variant.
    }
  SWIFT
  ,
  <<~'SWIFT' => <<~'SWIFT'
    @objc public func initiateOnDeviceConversionMeasurement(hashedEmail: Data) {
        Analytics.initiateOnDeviceConversionMeasurement(hashedEmailAddress: hashedEmail)
    }
  SWIFT
    @objc public func initiateOnDeviceConversionMeasurement(hashedEmail: Data) {
        // No-op for the no-IDFA Analytics pod variant.
    }
  SWIFT
  ,
  <<~'SWIFT' => <<~'SWIFT'
    @objc public func initiateOnDeviceConversionMeasurement(hashedPhone: Data) {
        Analytics.initiateOnDeviceConversionMeasurement(hashedPhoneNumber: hashedPhone)
    }
  SWIFT
    @objc public func initiateOnDeviceConversionMeasurement(hashedPhone: Data) {
        // No-op for the no-IDFA Analytics pod variant.
    }
  SWIFT
}

replacements.each do |from, to|
  source = source.sub(from, to)
end

File.write(path, source)
RUBY
fi

if ! grep -q "CapacitorFirebaseAnalytics/Analytics" "$PODFILE"; then
  ruby -0pi -e "sub(/# Add your Pods here\\n/, \"# Add your Pods here\\n  pod 'CapacitorFirebaseAnalytics\\/AnalyticsWithoutAdIdSupport', :path => '..\\/..\\/node_modules\\/@capacitor-firebase\\/analytics'\\n\")" "$PODFILE"
fi

if [ -f "$ICON_SOURCE" ]; then
  mkdir -p "$APPICON_DIR"

  make_icon() {
    local size="$1"
    local filename="$2"
    sips -z "$size" "$size" "$ICON_SOURCE" --out "$APPICON_DIR/$filename" >/dev/null
  }

  make_icon 40 "Icon-App-20x20@2x.png"
  make_icon 60 "Icon-App-20x20@3x.png"
  make_icon 58 "Icon-App-29x29@2x.png"
  make_icon 87 "Icon-App-29x29@3x.png"
  make_icon 80 "Icon-App-40x40@2x.png"
  make_icon 120 "Icon-App-40x40@3x.png"
  make_icon 120 "Icon-App-60x60@2x.png"
  make_icon 180 "Icon-App-60x60@3x.png"
  make_icon 20 "Icon-App-20x20@1x-ipad.png"
  make_icon 40 "Icon-App-20x20@2x-ipad.png"
  make_icon 29 "Icon-App-29x29@1x-ipad.png"
  make_icon 58 "Icon-App-29x29@2x-ipad.png"
  make_icon 40 "Icon-App-40x40@1x-ipad.png"
  make_icon 80 "Icon-App-40x40@2x-ipad.png"
  make_icon 76 "Icon-App-76x76@1x-ipad.png"
  make_icon 152 "Icon-App-76x76@2x-ipad.png"
  make_icon 167 "Icon-App-83.5x83.5@2x-ipad.png"
  make_icon 1024 "Icon-App-1024x1024@1x.png"

  cat > "$APPICON_DIR/Contents.json" <<'JSON'
{
  "images": [
    { "size": "20x20", "idiom": "iphone", "filename": "Icon-App-20x20@2x.png", "scale": "2x" },
    { "size": "20x20", "idiom": "iphone", "filename": "Icon-App-20x20@3x.png", "scale": "3x" },
    { "size": "29x29", "idiom": "iphone", "filename": "Icon-App-29x29@2x.png", "scale": "2x" },
    { "size": "29x29", "idiom": "iphone", "filename": "Icon-App-29x29@3x.png", "scale": "3x" },
    { "size": "40x40", "idiom": "iphone", "filename": "Icon-App-40x40@2x.png", "scale": "2x" },
    { "size": "40x40", "idiom": "iphone", "filename": "Icon-App-40x40@3x.png", "scale": "3x" },
    { "size": "60x60", "idiom": "iphone", "filename": "Icon-App-60x60@2x.png", "scale": "2x" },
    { "size": "60x60", "idiom": "iphone", "filename": "Icon-App-60x60@3x.png", "scale": "3x" },
    { "size": "20x20", "idiom": "ipad", "filename": "Icon-App-20x20@1x-ipad.png", "scale": "1x" },
    { "size": "20x20", "idiom": "ipad", "filename": "Icon-App-20x20@2x-ipad.png", "scale": "2x" },
    { "size": "29x29", "idiom": "ipad", "filename": "Icon-App-29x29@1x-ipad.png", "scale": "1x" },
    { "size": "29x29", "idiom": "ipad", "filename": "Icon-App-29x29@2x-ipad.png", "scale": "2x" },
    { "size": "40x40", "idiom": "ipad", "filename": "Icon-App-40x40@1x-ipad.png", "scale": "1x" },
    { "size": "40x40", "idiom": "ipad", "filename": "Icon-App-40x40@2x-ipad.png", "scale": "2x" },
    { "size": "76x76", "idiom": "ipad", "filename": "Icon-App-76x76@1x-ipad.png", "scale": "1x" },
    { "size": "76x76", "idiom": "ipad", "filename": "Icon-App-76x76@2x-ipad.png", "scale": "2x" },
    { "size": "83.5x83.5", "idiom": "ipad", "filename": "Icon-App-83.5x83.5@2x-ipad.png", "scale": "2x" },
    { "size": "1024x1024", "idiom": "ios-marketing", "filename": "Icon-App-1024x1024@1x.png", "scale": "1x" }
  ],
  "info": { "version": 1, "author": "xcode" }
}
JSON
fi

if [ -f "$INFO_PLIST" ]; then
  if [ -n "${BUILD_NUMBER:-}" ]; then
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" "$INFO_PLIST" 2>/dev/null ||
      /usr/libexec/PlistBuddy -c "Add :CFBundleVersion string $BUILD_NUMBER" "$INFO_PLIST"
  fi
  /usr/libexec/PlistBuddy -c "Delete :ITSAppUsesNonExemptEncryption" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$INFO_PLIST"
  /usr/libexec/PlistBuddy -c "Delete :NSCameraUsageDescription" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :NSCameraUsageDescription string WaFli usa la camara para adjuntar fotos a tus chats." "$INFO_PLIST"
  /usr/libexec/PlistBuddy -c "Delete :NSMicrophoneUsageDescription" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string WaFli usa el microfono para grabar notas de voz." "$INFO_PLIST"
  /usr/libexec/PlistBuddy -c "Delete :NSPhotoLibraryUsageDescription" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :NSPhotoLibraryUsageDescription string WaFli usa tu galeria para adjuntar imagenes y videos a tus chats." "$INFO_PLIST"
  /usr/libexec/PlistBuddy -c "Delete :NSPhotoLibraryAddUsageDescription" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :NSPhotoLibraryAddUsageDescription string WaFli puede guardar archivos que descargues desde tus chats." "$INFO_PLIST"
fi

if [ -f "$INFO_PLIST" ] && [ -n "${GOOGLE_REVERSED_CLIENT_ID:-}" ]; then
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0 dict" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $GOOGLE_REVERSED_CLIENT_ID" "$INFO_PLIST" 2>/dev/null || true
fi

cat > "$ENTITLEMENTS_PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>aps-environment</key>
  <string>production</string>
  <key>com.apple.developer.applesignin</key>
  <array>
    <string>Default</string>
  </array>
</dict>
</plist>
PLIST

if [ -f "$PRIVACY_MANIFEST_SOURCE" ]; then
  cp "$PRIVACY_MANIFEST_SOURCE" "$PRIVACY_MANIFEST_PLIST"
fi

if [ -d "$XCODEPROJ" ]; then
  XCODEPROJ_PATH="$XCODEPROJ" ruby <<'RUBY'
require 'xcodeproj'

project_path = ENV.fetch('XCODEPROJ_PATH')
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |candidate| candidate.name == 'App' } || project.targets.first
raise 'Could not find an Xcode target to attach iOS resources' unless target

app_group = project.main_group.find_subpath('App', true)

['GoogleService-Info.plist', 'PrivacyInfo.xcprivacy'].each do |resource_name|
  next unless File.exist?(File.join(File.dirname(project_path), 'App', resource_name))
  file_ref = app_group.files.find { |file| file.path == resource_name } ||
             app_group.new_file(resource_name)

  unless target.resources_build_phase.files_references.any? { |file| file.path == resource_name }
    target.resources_build_phase.add_file_reference(file_ref)
  end
end

target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
end

target_attributes = project.root_object.attributes['TargetAttributes'] ||= {}
target_settings = target_attributes[target.uuid] ||= {}
capabilities = target_settings['SystemCapabilities'] ||= {}
capabilities['com.apple.SignInWithApple'] = { 'enabled' => 1 }
capabilities['com.apple.Push'] = { 'enabled' => 1 }

project.save
RUBY
fi

echo "iOS project prepared for Codemagic."
