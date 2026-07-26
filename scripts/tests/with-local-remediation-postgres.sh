#!/bin/sh
set -eu

if [ "$#" -eq 0 ]; then
  echo "usage: $0 command [args ...]" >&2
  exit 64
fi

for binary in initdb pg_ctl createdb; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    echo "required PostgreSQL binary missing: $binary" >&2
    exit 69
  fi
done

data_dir=$(mktemp -d "${TMPDIR:-/tmp}/mise-remediation-pg.XXXXXX")
socket_dir=$(mktemp -d "${TMPDIR:-/tmp}/mise-remediation-pg-socket.XXXXXX")
port_file=$(mktemp "${TMPDIR:-/tmp}/mise-remediation-pg-port.XXXXXX")

cleanup() {
  if [ -s "$data_dir/postmaster.pid" ]; then
    pg_ctl -D "$data_dir" -m fast stop >/dev/null 2>&1 || true
  fi
  rm -rf "$data_dir" "$socket_dir"
  rm -f "$port_file"
}
trap cleanup EXIT INT TERM

# Pick an unused high port without contacting any external service.
python3 - "$port_file" <<'PY'
import socket
import sys

with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
with open(sys.argv[1], "w", encoding="utf-8") as handle:
    handle.write(str(port))
PY
port=$(cat "$port_file")

initdb -D "$data_dir" --auth=trust --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$data_dir" -o "-h 127.0.0.1 -p $port -k $socket_dir" -w start >/dev/null
createdb -h 127.0.0.1 -p "$port" mise_remediation

TEST_DATABASE_URL="postgresql://127.0.0.1:$port/mise_remediation"
export TEST_DATABASE_URL

"$@"
