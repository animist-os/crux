# Bootstrap codex/gemini CLIs inside the Cowork sandbox.
# Installs are per-session (the VM resets), so source this in the SAME bash
# call as the shell-out — bash calls don't share env:
#   . "$(dirname "$0")/bootstrap-sandbox.sh" && codex exec "..."
# Keys are read from .secrets/sandbox.env at the repo root (gitignored).
#
# Everything installs under /tmp: the /sessions volume is shared and often
# nearly full, and a full disk makes npm silently skip the platform-specific
# optionalDependency that contains codex's native binary ("missing arm64
# build"). /tmp lives on the root volume with far more headroom.

# Namespace by uid: /tmp is shared and same-named dirs from other users
# (root, nobody) are unwritable to us.
_fable_tmp="/tmp/fable-$(id -u)"
export NPM_CONFIG_PREFIX="$_fable_tmp/npm-global"
export npm_config_cache="$_fable_tmp/npm-cache"
export CODEX_HOME="$_fable_tmp/codex-home"  # keeps codex auth + tmp off /sessions
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
export GEMINI_CLI_TRUST_WORKSPACE=true  # headless sandbox — no interactive trust prompt
mkdir -p "$NPM_CONFIG_PREFIX" "$npm_config_cache" "$CODEX_HOME"

command -v codex >/dev/null 2>&1 || npm i -g @openai/codex --silent >/dev/null 2>&1
command -v gemini >/dev/null 2>&1 || npm i -g @google/gemini-cli --silent >/dev/null 2>&1

# Health check: the sandbox egress proxy flakily corrupts the large native-
# binary tarball (ERR_SSL_CIPHER_OPERATION_FAILED), leaving a codex wrapper
# that can't run ("missing arm64 build"). Clean-reinstall up to 4 times —
# retries usually get a clean download — then fail LOUDLY.
_tries=0
until codex --version 2>/dev/null | grep -q '^codex-cli' || [ "$_tries" -ge 4 ]; do
  _tries=$((_tries + 1))
  rm -rf "$NPM_CONFIG_PREFIX/lib/node_modules/@openai"
  npm cache clean --force >/dev/null 2>&1
  npm i -g @openai/codex --silent >/dev/null 2>&1
done
if ! codex --version 2>/dev/null | grep -q '^codex-cli'; then
  echo "ERROR: codex native binary is broken in this sandbox (likely disk-full during" >&2
  echo "install; check 'df -h /tmp'). Per CLAUDE.md §2, substitute a fresh-context" >&2
  echo "Sonnet agent for external review and log the substitution in docs/shell-out.log." >&2
  BOOTSTRAP_CODEX_OK=0
else
  BOOTSTRAP_CODEX_OK=1
fi

_here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_secrets="$_here/../.secrets/sandbox.env"
if [ -f "$_secrets" ]; then
  set -a; . "$_secrets"; set +a
  # codex ignores OPENAI_API_KEY from env; it must be registered once per session.
  if [ "$BOOTSTRAP_CODEX_OK" = 1 ]; then
    codex login status >/dev/null 2>&1 || printenv OPENAI_API_KEY | codex login --with-api-key >/dev/null 2>&1
  fi
else
  echo "WARN: $_secrets not found — CLIs installed but unauthenticated." >&2
fi

[ "$BOOTSTRAP_CODEX_OK" = 1 ] && codex --version 2>/dev/null | head -1
gemini --version 2>/dev/null | tail -1
