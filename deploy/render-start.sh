#!/bin/sh
set -eu
if [ -n "${RENDER_EXTERNAL_URL:-}" ]; then
    export LUNGITUDE_PUBLIC_ORIGIN="$RENDER_EXTERNAL_URL"
fi
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/lungitude.conf
