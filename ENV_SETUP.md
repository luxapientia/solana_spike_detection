# Environment Variables Setup

Copy the following to create your `.env` file:

```env
# Telegram Bot Configuration (REQUIRED)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Bot Configuration
MIN_TOKEN_AGE_HOURS=1
MAX_MARKET_CAP=100000

# Alert Thresholds (true/false)
ALERT_THRESHOLD_25=true
ALERT_THRESHOLD_50=true

# Polling Configuration (in milliseconds)
POLLING_INTERVAL_MS=60000

# Optional: Logging Level
LOG_LEVEL=info
```

## Getting Your Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the bot token provided
5. Paste it in your `.env` file as `TELEGRAM_BOT_TOKEN`

## Configuration Options

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from BotFather (required)
- `MIN_TOKEN_AGE_HOURS`: Minimum age for tokens to be monitored (default: 1 hour)
- `MAX_MARKET_CAP`: Maximum market cap in USD (default: 100000)
- `ALERT_THRESHOLD_25`: Enable/disable 25% spike alerts (default: true)
- `ALERT_THRESHOLD_50`: Enable/disable 50% spike alerts (default: true)
- `POLLING_INTERVAL_MS`: How often to check for spikes in milliseconds (default: 60000 = 1 minute)

Note: Most settings can also be changed via Telegram bot commands without restarting.
