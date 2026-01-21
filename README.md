# Solana Dormant Token Spike Detector

A production-ready Telegram bot that automatically detects sudden price breakouts in dormant, low-market-cap Solana tokens and notifies users in near real time.

## Features

- 🔍 **Automated Token Discovery**: Continuously discovers tokens from Pump and Bonk launchpads
- 📊 **Dormant State Detection**: Identifies tokens in quiet/dormant states before breakouts
- 🚨 **Spike Detection**: Detects +25% and +50% price spikes within 5 minutes
- 📱 **Real-time Alerts**: Instant Telegram notifications with detailed token information
- ⚙️ **Fully Configurable**: Adjust settings via Telegram commands without restarting
- 🛡️ **Production Ready**: Error handling, rate limiting, and graceful shutdown

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Telegram Bot Token (get it from [@BotFather](https://t.me/botfather))

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your configuration:
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   MIN_TOKEN_AGE_HOURS=1
   MAX_MARKET_CAP=100000
   ALERT_THRESHOLD_25=true
   ALERT_THRESHOLD_50=true
   POLLING_INTERVAL_MS=60000
   ```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Build Only
```bash
npm run build
```

## Telegram Bot Commands

Once the bot is running, send these commands to your bot:

- `/start` - Start the bot and begin receiving alerts
- `/status` - Show current configuration and bot status
- `/threshold [25|50] [on|off]` - Enable or disable alert thresholds
  - Example: `/threshold 25 on` - Enable 25% alerts
  - Example: `/threshold 50 off` - Disable 50% alerts
- `/age [hours]` - Set minimum token age filter
  - Example: `/age 6` - Set minimum age to 6 hours
- `/pause` - Pause alerting
- `/resume` - Resume alerting
- `/help` - Display all available commands

## Alert Format

Each alert includes:
- 🪙 Token name and symbol
- 💰 Current price
- 📈 Price change percentage (5 minutes)
- 💵 Market cap
- 💧 Liquidity
- 📊 Volume (5 minutes)
- 🔗 DexScreener and Jupiter links
- ⏰ Timestamp

## How It Works

1. **Token Discovery**: Bot continuously searches for tokens from Pump and Bonk launchpads
2. **Filtering**: Applies filters for market cap (< $100k), minimum age, and launchpad verification
3. **State Tracking**: Maintains historical snapshots for each token to determine dormant state
4. **Dormant Detection**: Identifies tokens with low volatility, volume, and market cap changes
5. **Spike Detection**: Monitors for +25% or +50% price increases within 5 minutes
6. **Validation**: Ensures tokens transition from dormant to breakout state
7. **Alerting**: Sends formatted Telegram alerts with all relevant information

## Project Structure

```
src/
 ├─ bot/              # Telegram bot implementation
 │  ├─ TelegramBot.ts      # Main bot class with commands
 │  └─ AlertFormatter.ts   # Alert message formatting
 ├─ detector/         # Detection engines
 │  ├─ SpikeDetector.ts          # Spike detection logic
 │  └─ TokenUniverseManager.ts   # Token discovery and tracking
 ├─ services/         # External service integrations
 │  ├─ DexScreenerService.ts     # DexScreener API wrapper
 │  └─ SpikeDetectionService.ts  # Main orchestrator service
 ├─ data/             # Data storage and management
 │  └─ TokenState.ts         # Historical state tracking
 ├─ utils/            # Utility functions
 │  ├─ Config.ts           # Configuration management
 │  ├─ ErrorHandler.ts     # Error handling and retry logic
 │  └─ RateLimiter.ts      # API rate limiting
 └─ index.ts          # Application entry point
```

## Configuration

All configuration can be adjusted via environment variables or Telegram commands:

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Required | Your Telegram bot token |
| `MIN_TOKEN_AGE_HOURS` | 1 | Minimum token age in hours |
| `MAX_MARKET_CAP` | 100000 | Maximum market cap in USD |
| `ALERT_THRESHOLD_25` | true | Enable/disable 25% alerts |
| `ALERT_THRESHOLD_50` | true | Enable/disable 50% alerts |
| `POLLING_INTERVAL_MS` | 60000 | Polling interval in milliseconds |

## Features Details

### Dormant State Detection
A token is considered dormant if:
- Price volatility is below 5% within the baseline period
- Trading volume is below $1,000 in the baseline period
- Market cap shows minimal change

### Spike Detection
- Monitors 5-minute rolling windows for price changes
- Requires tokens to be in dormant state before spike
- Implements cooldown periods to prevent duplicate alerts
- Validates basic criteria (market cap, liquidity, price data)

### Rate Limiting
- Respects DexScreener API rate limits (300 requests/minute)
- Implements exponential backoff for retries
- Handles network errors gracefully

## Production Deployment

### VPS Deployment
1. Clone repository to your VPS
2. Install Node.js 18+
3. Configure `.env` file
4. Build: `npm run build`
5. Run with process manager (PM2 recommended):
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name spike-detector
   pm2 save
   pm2 startup
   ```

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

## Troubleshooting

- **Bot not responding**: Check `TELEGRAM_BOT_TOKEN` in `.env`
- **No alerts**: Verify tokens are being discovered (check logs)
- **Rate limit errors**: Adjust `POLLING_INTERVAL_MS` to reduce frequency
- **High memory usage**: Old token states are cleaned up every 6 hours

## Contributing

This is a production-ready implementation following the requirements specification. All components are modular and can be extended.

## License

MIT
