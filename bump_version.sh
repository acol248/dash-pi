#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARGO_FILE="$SCRIPT_DIR/camera/Cargo.toml"
DASHBOARD_DIR="$SCRIPT_DIR/dashboard"

usage() {
  cat <<'EOF'
Usage:
  ./bump_version.sh <patch|minor|major> [--dry-run]

Examples:
  ./bump_version.sh patch
  ./bump_version.sh minor --dry-run
EOF
}

bump_version() {
  local current="$1"
  local kind="$2"
  local major minor patch

  if [[ ! "$current" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "Error: version '$current' is not in semver format X.Y.Z" >&2
    return 1
  fi

  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  patch="${BASH_REMATCH[3]}"

  case "$kind" in
    patch)
      patch=$((patch + 1))
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    *)
      echo "Error: bump type must be patch, minor, or major" >&2
      return 1
      ;;
  esac

  echo "$major.$minor.$patch"
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

BUMP_TYPE="$1"
DRY_RUN="false"

if [[ $# -eq 2 ]]; then
  if [[ "$2" != "--dry-run" ]]; then
    echo "Error: unknown option '$2'" >&2
    usage
    exit 1
  fi
  DRY_RUN="true"
fi

if [[ ! -f "$CARGO_FILE" ]]; then
  echo "Error: missing file '$CARGO_FILE'" >&2
  exit 1
fi

if [[ ! -f "$DASHBOARD_DIR/package.json" ]]; then
  echo "Error: missing file '$DASHBOARD_DIR/package.json'" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but not installed or not in PATH" >&2
  exit 1
fi

CARGO_VERSION="$(awk -F'"' '/^version = "/ {print $2; exit}' "$CARGO_FILE")"
DASHBOARD_VERSION="$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); console.log(p.version);" "$DASHBOARD_DIR/package.json")"

if [[ -z "$CARGO_VERSION" || -z "$DASHBOARD_VERSION" ]]; then
  echo "Error: could not read current version(s)" >&2
  exit 1
fi

if [[ "$CARGO_VERSION" != "$DASHBOARD_VERSION" ]]; then
  echo "Error: version mismatch detected:" >&2
  echo "  camera/Cargo.toml:    $CARGO_VERSION" >&2
  echo "  dashboard/package.json: $DASHBOARD_VERSION" >&2
  echo "Please align versions manually before bumping." >&2
  exit 1
fi

NEW_VERSION="$(bump_version "$CARGO_VERSION" "$BUMP_TYPE")"

echo "Current version: $CARGO_VERSION"
echo "New version:     $NEW_VERSION"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run only. No files were changed."
  exit 0
fi

TMP_FILE="$(mktemp)"
awk -v new_version="$NEW_VERSION" '
  BEGIN { in_package = 0; replaced = 0 }
  /^\[package\]$/ { in_package = 1; print; next }
  /^\[/ && $0 != "[package]" { in_package = 0 }
  {
    if (in_package && !replaced && $0 ~ /^version = "/) {
      print "version = \"" new_version "\""
      replaced = 1
      next
    }
    print
  }
  END {
    if (!replaced) {
      exit 1
    }
  }
' "$CARGO_FILE" > "$TMP_FILE"

mv "$TMP_FILE" "$CARGO_FILE"

(
  cd "$DASHBOARD_DIR"
  npm version "$NEW_VERSION" --no-git-tag-version >/dev/null
)

echo "Updated: camera/Cargo.toml"
echo "Updated: dashboard/package.json"
echo "Updated: dashboard/package-lock.json"
echo "Version bump complete."
