#!/bin/sh
# One-off proposed installer. Requires explicit approval and root execution.
set -eu
[ "$#" -eq 0 ] || { echo 'No arguments allowed.' >&2; exit 64; }
[ "$(id -u)" -eq 0 ] || { echo 'Run as root.' >&2; exit 1; }
id codex-audit >/dev/null
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
source_file="$script_dir/demand-aggregate-evidence.sh"
expected=29d01c2ba032b988349e28dd23d132401fd00cdb1d4b8a0a74d392bbcbe9eb40
printf '%s  %s\n' "$expected" "$source_file" | /usr/bin/sha256sum -c -
for path in /usr/local /usr/local/sbin /etc/sudoers.d; do
 [ "$(/usr/bin/stat -c '%u:%g:%a' "$path")" = '0:0:755' ] || { echo "Unexpected ownership or mode: $path" >&2; exit 1; }
done
[ -x /usr/bin/docker ] && [ -x /usr/sbin/visudo ]
wrapper=/usr/local/sbin/taxicrm-demand-evidence
rule=/etc/sudoers.d/taxicrm-demand-evidence
for path in "$wrapper" "$rule"; do
 if [ -e "$path" ] || [ -L "$path" ]; then echo "Already exists: $path" >&2; exit 1; fi
done
temp_rule=$(/usr/bin/mktemp /root/taxicrm-demand-sudoers.XXXXXXXX)
trap '/usr/bin/unlink "$temp_rule" 2>/dev/null || true' 0
printf '%s\n' 'codex-audit ALL=(root) NOPASSWD: NOSETENV: /usr/local/sbin/taxicrm-demand-evidence ""' > "$temp_rule"
/usr/sbin/visudo -cf "$temp_rule"
/usr/bin/install -o root -g root -m 0755 "$source_file" "$wrapper"
if ! /usr/bin/install -o root -g root -m 0440 "$temp_rule" "$rule"; then
 /usr/bin/unlink "$wrapper"
 echo 'Sudo rule install failed; wrapper removed.' >&2
 exit 1
fi
echo 'Fixed aggregate command installed.'
