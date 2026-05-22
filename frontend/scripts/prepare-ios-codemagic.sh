#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$ROOT_DIR/ios"
PODFILE="$IOS_DIR/App/Podfile"

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

if [ -f "$IOS_DIR/App/App/Info.plist" ] && [ -n "${GOOGLE_REVERSED_CLIENT_ID:-}" ]; then
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" "$IOS_DIR/App/App/Info.plist" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0 dict" "$IOS_DIR/App/App/Info.plist" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$IOS_DIR/App/App/Info.plist" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $GOOGLE_REVERSED_CLIENT_ID" "$IOS_DIR/App/App/Info.plist" 2>/dev/null || true
fi

echo "iOS project prepared for Codemagic."
