#!/bin/bash

# Exit on error
set -e

MANIFEST_FILE="src/manifest.json"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "jq could not be found. Please install jq."
    exit 1
fi

# Check if zip is installed
if ! command -v zip &> /dev/null; then
    echo "zip could not be found. Please install zip."
    exit 1
fi

# Parse arguments
IS_MAJOR=0
for arg in "$@"; do
    if [[ "$arg" == "--major" ]]; then
        IS_MAJOR=1
    fi
done

# 1. Read current version and bump
CURRENT_VERSION=$(jq -r '.version' "$MANIFEST_FILE")
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"

MAJOR="${VERSION_PARTS[0]:-1}"
MINOR="${VERSION_PARTS[1]:-0}"
PATCH="${VERSION_PARTS[2]}"

if [[ "$IS_MAJOR" -eq 1 ]]; then
    MAJOR=$((MAJOR + 1))
    MINOR=0
    if [[ -n "$PATCH" ]]; then PATCH=0; fi
else
    MINOR=$((MINOR + 1))
    if [[ -n "$PATCH" ]]; then PATCH=0; fi
fi

if [[ -n "$PATCH" ]]; then
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
else
    NEW_VERSION="$MAJOR.$MINOR"
fi

echo "Bumping version from $CURRENT_VERSION to $NEW_VERSION..."

# Update version in src/manifest.json
TMP_FILE=$(mktemp)
jq --arg v "$NEW_VERSION" '.version = $v' "$MANIFEST_FILE" > "$TMP_FILE"
mv "$TMP_FILE" "$MANIFEST_FILE"

# 2. Build the extension
echo "Building extension for production..."
yarn build --mode=production

# 3. Create releases directory
mkdir -p releases
CHROME_ZIP="../releases/big-video-chrome-v${NEW_VERSION}.zip"
FIREFOX_ZIP="../releases/big-video-firefox-v${NEW_VERSION}.zip"

# 4. Package extensions
cd dist

echo "Packaging for Firefox..."
rm -f "$FIREFOX_ZIP"
zip -rq "$FIREFOX_ZIP" *

echo "Packaging for Chrome..."
rm -f "$CHROME_ZIP"
# Remove firefox-specific settings for Chrome to avoid store warnings
if jq -e '.browser_specific_settings' manifest.json > /dev/null; then
    jq 'del(.browser_specific_settings)' manifest.json > manifest_chrome.json
    mv manifest_chrome.json manifest.json
fi
zip -rq "$CHROME_ZIP" *

echo ""
echo "Successfully created:"
echo " - releases/big-video-chrome-v${NEW_VERSION}.zip"
echo " - releases/big-video-firefox-v${NEW_VERSION}.zip"
