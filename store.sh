#!/bin/bash

# Exit on error
set -e

# Ensure jq is installed
if ! command -v jq &> /dev/null; then
    echo "jq could not be found. Please install jq."
    exit 1
fi

# Ensure rsync is installed
if ! command -v rsync &> /dev/null; then
    echo "rsync could not be found. Please install rsync."
    exit 1
fi

MANIFEST_FILE="src/manifest.json"
if [ ! -f "$MANIFEST_FILE" ]; then
    echo "Error: $MANIFEST_FILE not found."
    exit 1
fi

VERSION=$(jq -r '.version' "$MANIFEST_FILE")
SOURCE_FOLDER="store-source"
ZIP_NAME="releases/big-video-source-v${VERSION}.zip"

echo "Preparing source code for store submission..."

# Remove previous folder if it exists
if [ -d "$SOURCE_FOLDER" ]; then
    rm -rf "$SOURCE_FOLDER"
fi

mkdir -p "$SOURCE_FOLDER"

# Use rsync to copy files, excluding the unwanted directories and files
echo "Copying files to ./$SOURCE_FOLDER..."
rsync -a ./ "$SOURCE_FOLDER/" \
    --exclude='.yarn/' \
    --exclude='dist/' \
    --exclude='node_modules/' \
    --exclude='releases/' \
    --exclude='Store.md' \
    --exclude='store.md' \
    --exclude='.git/' \
    --exclude="$SOURCE_FOLDER/" \
    --exclude='store.sh'

echo "Source files successfully prepped in ./$SOURCE_FOLDER directory."

# Also create a zip file in releases/ for convenience
if command -v zip &> /dev/null; then
    mkdir -p releases
    echo "Creating zip archive: $ZIP_NAME"
    rm -f "$ZIP_NAME"
    cd "$SOURCE_FOLDER"
    zip -rq "../$ZIP_NAME" .
    cd ..
    echo "Successfully created $ZIP_NAME"
else
    echo "zip command not found. Skipping zip creation."
fi
