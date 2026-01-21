# Solana Dormant Token Spike Detector (Telegram Bot)

## 1. Project Purpose

The purpose of this project is to build a **Telegram bot** that automatically detects **sudden price breakouts in dormant, low-market-cap Solana tokens** and notifies the user in near real time.

The bot focuses on tokens that have shown **little to no activity for a period of time** and then suddenly experience a **+25% or +50% price increase within 5 minutes**. These early breakouts are difficult to spot manually due to the large number of Solana tokens.

This project is **not a trading bot**. It is a **signal discovery and monitoring tool** designed to surface early momentum opportunities for further analysis or manual trading.

---

## 2. Project Scope

- **Blockchain**: Solana only
- **Token standard**: SPL tokens
- **Launchpads monitored**:
  - Pump
  - Bonk
- **Data source**: DexScreener API (via `dexscreener-sdk`)
- **Alert delivery**: Telegram

---

## 3. Functional Requirements

### 3.1 Token Universe Filtering

The bot must continuously scan tokens that meet all of the following conditions:

- Token launched via **Pump or Bonk** launchpads
- Market capitalization **below $100,000**
- Token age **greater than or equal to a configurable minimum age**
  - Default: **1 hour**
  - User-adjustable: 1h / 6h / 24h / custom
- No maximum age limit (tokens may be years old)

---

### 3.2 Dormant / Quiet State Detection

A token is considered **quiet (dormant)** if, during a baseline period before a spike:

- **Price volatility** is minimal
  - Price change within the baseline window is below a small threshold
- **Trading volume** is near zero or extremely low
- **Market cap** shows no meaningful change

This condition represents a flat or "serpent-like" chart with no clear trend or volatility.

Only tokens that transition from a **quiet state to a breakout** are eligible for alerts.

---

### 3.3 Spike Detection Logic

The bot must detect sudden price increases using a rolling window.

**Spike conditions**:
- +25% price increase within 5 minutes
- +50% price increase within 5 minutes

**Additional rules**:
- Token must have been in a quiet state before the spike
- Alerts are tiered:
  - Tier 1: +25%
  - Tier 2: +50%
- Cooldown is applied to avoid repeated alerts for the same token and tier

---

### 3.4 Telegram Alerts

Each alert message must include:

- Token name and symbol
- Price change percentage
- Timeframe (5 minutes)
- Current price
- Market cap
- Volume increase
- Liquidity
- DexScreener link
- Jupiter link
- Timestamp

Alerts must be sent immediately once a valid spike is detected.

---

### 3.5 Telegram Bot Commands

The Telegram bot must support the following commands:

- `/start` – Start the bot
- `/status` – Show current configuration
- `/threshold` – Enable or disable 25% / 50% alerts
- `/age` – Set minimum token age filter
- `/pause` – Pause alerting
- `/resume` – Resume alerting
- `/help` – Display command help

All configuration changes must apply immediately without restarting the bot.

---

## 4. Non-Functional Requirements

### Stability
- Must run continuously on a VPS
- Automatic recovery from errors
- Graceful handling of API failures and rate limits

### Performance
- Capable of tracking thousands of tokens
- Uses asynchronous and batched requests
- Efficient memory usage

### Maintainability
- Clear folder structure
- Modular design
- Readable logging

---

## 5. Technology Stack

- **Language**: Node.js (JavaScript / TypeScript)
- **API SDK**: `dexscreener-sdk`
- **Telegram**: `node-telegram-bot-api`
- **Environment config**: `dotenv`
- **Scheduler**: Custom polling loop or cron-based scheduler

---

## 6. Step-by-Step Development Plan

### Phase 1: Project Setup

1. Initialize Node.js project
2. Install dependencies
3. Configure environment variables
4. Create base folder structure

```
src/
 ├─ bot/
 ├─ detector/
 ├─ services/
 ├─ data/
 ├─ utils/
```

---

### Phase 2: DexScreener Integration

1. Integrate `dexscreener-sdk`
2. Fetch Solana token pairs
3. Filter Pump and Bonk launchpad tokens
4. Normalize token data

---

### Phase 3: Token Universe Management

1. Maintain an active list of eligible tokens
2. Apply market cap and age filters
3. Continuously update the universe

---

### Phase 4: Baseline State Engine

1. Store rolling historical snapshots per token
2. Compute volatility, volume, and mcap changes
3. Classify tokens as quiet or active

---

### Phase 5: Spike Detection Engine

1. Maintain rolling 5-minute price windows
2. Calculate percentage price change
3. Check threshold conditions
4. Validate quiet-to-breakout transition
5. Trigger alert events

---

### Phase 6: Telegram Bot Implementation

1. Initialize Telegram bot
2. Implement commands and configuration handling
3. Format alert messages
4. Send alerts in real time

---

### Phase 7: Optimization & Safety

1. Implement rate-limit protection
2. Add retry logic and error handling
3. Optimize polling and batching
4. Add structured logging

---

### Phase 8: Packaging & Delivery

1. Write README documentation
2. Test on VPS environment
3. Package project into ZIP file
4. Final verification and handoff

---

## 7. Final Result

The final system will be a **production-ready Telegram bot** capable of detecting **early breakout signals in dormant Solana tokens**, fully configurable and optimized for experimentation and future expansion.

