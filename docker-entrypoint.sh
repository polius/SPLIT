#!/bin/sh

# Default values
CURRENCY="${CURRENCY:-€}"
CURRENCY_POSITION="${CURRENCY_POSITION:-right}"

# Create config.js with environment variables
cat > /usr/share/nginx/html/config.js << EOF
window.APP_CONFIG = {
  currency: '${CURRENCY}',
  currencyPosition: '${CURRENCY_POSITION}'
};
EOF

# Execute the main command
exec "$@"
