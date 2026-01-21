📘 Project Requirements

Solana Pump.fun & BONK Dead-Coin Spike Alert Bot

1. Project Overview

Build a Telegram alert bot that continuously monitors Solana tokens originating only from Pump.fun (“pump bags”) and BONK launchpads, detects sudden price spikes (+25% or more in 5 minutes) in previously inactive tokens, and sends real-time alerts.

The system is designed for signal discovery, not trading automation.

2. Scope & Non-Goals
In Scope

Token discovery & registry

Token age filtering

Inactivity (dead/bag) detection

Real-time price & volume monitoring

Spike detection

Telegram alerting

Configuration controls

Explicitly Out of Scope

Auto-buy / auto-sell

Wallet tracking

Insider analysis

Sentiment analysis

AI prediction models

Multi-chain support

3. Supported Blockchain & Ecosystem

Blockchain: Solana

DEX data sources:

Jupiter

Dexscreener

Token origins (hard-restricted):

Pump.fun

BONK launchpads

Tokens not originating from these sources must never be scanned or alerted.

4. Token Universe Definition
4.1 Source Classification

Each token must belong to exactly one source:

Source	Definition
pumpfun	Tokens minted via Pump.fun
bonk	Tokens launched via BONK-associated launchpads

Tokens without a verified source are ignored permanently.

4.2 Token Registry (Required)

A persistent registry must exist containing:

{
  "mint": "string",
  "source": "pumpfun | bonk",
  "created_at": "unix_timestamp",
  "first_seen": "unix_timestamp",
  "last_scanned": "unix_timestamp",
  "last_alerted": "unix_timestamp | null"
}


The registry is the only source of truth for what is scanned.

5. Token Age Requirements
5.1 Minimum Age (Configurable)

A token must be at least X hours old before eligibility.

Supported values:

1 hour

6 hours

24 hours

Default: 1 hour

5.2 Maximum Age

No maximum age

Tokens may be months or years old

6. Market Cap Requirement

Token market cap must be ≤ $100,000 USD

Market cap must be evaluated at alert time

Tokens exceeding this value are skipped

7. Inactivity (“Bag / Dead Coin”) Detection

A token must exhibit clear inactivity prior to the spike.

7.1 Qualifying Inactivity Patterns

Flat or near-flat price (“serpent graph”)

Minimal volume

No recent volatility

7.2 Minimum Inactivity Criteria (MVP)

Before the 5-minute spike window:

Metric	Requirement
1h volume	< $500
1h price change	< ±5%
No 5m candle	> +10%

Tokens failing these checks are considered active and ignored.

8. Spike Detection Logic (Core Trigger)
8.1 Primary Trigger

An alert is triggered if:

Price increases ≥ +25%

Within the last 5 minutes

After satisfying all filters:

Source

Age

Market cap

Prior inactivity

8.2 Calculation
price_change_5m = (price_now - price_5m_ago) / price_5m_ago


Trigger condition:

price_change_5m ≥ 0.25

9. Market Data Requirements
9.1 Required Metrics per Token

Collected via Jupiter and Dexscreener:

Current price

Price 5 minutes ago

Volume (5m, 1h)

Liquidity

Market cap

DEX pair info

9.2 Polling Frequency

Every 10–15 seconds

Must support rolling 5-minute windows

10. Alerting Rules
10.1 Alert Conditions

An alert must be sent immediately when:

Spike condition is met

Token has not been alerted in the last X minutes (default: 10)

10.2 Alert Output (Telegram)

Each alert must include:

Token name / symbol

Mint address

Source (Pump.fun or BONK)

Token age

Market cap

5-minute price change (%)

Volume spike

Liquidity

Jupiter link

Dexscreener link

11. Spam Control (Minimal but Required)

One alert per token per cooldown window

Ignore tokens with:

Liquidity < $2,000

Ignore duplicate alerts for the same spike

Spam is expected but must remain technically manageable.

12. Configuration Requirements

All of the following must be configurable without code changes:

MIN_TOKEN_AGE_HOURS=1
PUMP_THRESHOLD_PERCENT=25
LOOKBACK_MINUTES=5
MAX_MARKET_CAP=100000
ALERT_COOLDOWN_MINUTES=10

13. System Behavior Summary

Discover Pump.fun and BONK tokens

Store them in a registry

Enforce age and source restrictions

Poll market data continuously

Detect inactivity → spike transitions

Send Telegram alerts in real time

14. Success Criteria

The system is considered successful if:

It never alerts tokens outside Pump.fun or BONK

It detects dead/bag coins before social media hype

Alerts occur within seconds of the +25% / 5m move

Configuration changes alter behavior without redeploys

15. Future-Ready (Not Required Now)

Additional spike thresholds (+50%, +100%)

Separate channels for Pump.fun vs BONK

Bag-state classification labels

Web dashboard

Historical signal analytics

Final Summary (One Line)

A Solana Telegram bot that monitors only Pump.fun and BONK tokens, filters for old, inactive low-cap coins, and alerts immediately when they spike +25% in 5 minutes.