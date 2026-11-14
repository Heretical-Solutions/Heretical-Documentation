#!/usr/bin/env bash
# Return CI source credentials only in response to Git's askpass prompts.
# The token is supplied through the environment and is never stored in a URL,
# source checkout, restore manifest, or generated artifact.
set -euo pipefail

case "${1:-}" in
*[Uu]sername*)
  printf '%s\n' "${PORTAL_SOURCE_USERNAME:-x-access-token}"
  ;;
*[Pp]assword*)
  [[ -n "${PORTAL_SOURCE_TOKEN:-}" ]] || exit 1
  printf '%s\n' "$PORTAL_SOURCE_TOKEN"
  ;;
*)
  exit 1
  ;;
esac
