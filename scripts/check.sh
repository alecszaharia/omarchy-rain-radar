#!/usr/bin/env bash
# Full validation gate: Omarchy plugin validator, qmllint over every QML file,
# and the node unit tests over the pure logic in Model.js.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
: "${OMARCHY_PATH:=/usr/share/omarchy}"
status=0

echo "── omarchy plugin validate ──"
if omarchy plugin validate "$PWD"; then echo "  ok"; else echo "  FAILED"; status=1; fi

echo "── qmllint ──"
shopt -s nullglob
qml_files=(*.qml)
if [ ${#qml_files[@]} -gt 0 ]; then
  if qmllint -I "$OMARCHY_PATH/shell" "${qml_files[@]}"; then echo "  ok"; else echo "  FAILED"; status=1; fi
else
  echo "  (no QML files yet)"
fi

echo "── node --test ──"
test_files=(tests/*.test.mjs)
if [ ${#test_files[@]} -gt 0 ]; then
  if node --test "${test_files[@]}"; then echo "  ok"; else echo "  FAILED"; status=1; fi
else
  echo "  (no tests yet)"
fi

echo "── symlink sweep ──"
if [ -z "$(find . -path ./.git -prune -o -type l -print)" ]; then echo "  ok"; else echo "  FAILED: symlinks present"; status=1; fi

exit $status
