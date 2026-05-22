#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$ROOT_DIR/ios"
PODFILE="$IOS_DIR/App/Podfile"
ICON_SOURCE="$ROOT_DIR/resources/icon.png"
APPICON_DIR="$IOS_DIR/App/App/Assets.xcassets/AppIcon.appiconset"
INFO_PLIST="$IOS_DIR/App/App/Info.plist"
GOOGLE_SERVICE_PLIST="$IOS_DIR/App/App/GoogleService-Info.plist"
XCODEPROJ="$IOS_DIR/App/App.xcodeproj"

if [ ! -d "$IOS_DIR" ]; then
  echo "Missing frontend/ios. Run: npx cap add ios"
  exit 1
fi

if [ ! -f "$PODFILE" ]; then
  echo "Missing $PODFILE. Capacitor iOS platform was not generated correctly."
  exit 1
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
fi

if [ -f "$INFO_PLIST" ] && [ -n "${GOOGLE_REVERSED_CLIENT_ID:-}" ]; then
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0 dict" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $GOOGLE_REVERSED_CLIENT_ID" "$INFO_PLIST" 2>/dev/null || true
fi

if [ -f "$GOOGLE_SERVICE_PLIST" ] && [ -d "$XCODEPROJ" ]; then
  XCODEPROJ_PATH="$XCODEPROJ" ruby <<'RUBY'
require 'xcodeproj'

project_path = ENV.fetch('XCODEPROJ_PATH')
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |candidate| candidate.name == 'App' } || project.targets.first
raise 'Could not find an Xcode target to attach GoogleService-Info.plist' unless target

app_group = project.main_group.find_subpath('App', true)
file_ref = app_group.files.find { |file| file.path == 'GoogleService-Info.plist' } ||
           app_group.new_file('GoogleService-Info.plist')

unless target.resources_build_phase.files_references.any? { |file| file.path == 'GoogleService-Info.plist' }
  target.resources_build_phase.add_file_reference(file_ref)
end

project.save
RUBY
fi

echo "iOS project prepared for Codemagic."
