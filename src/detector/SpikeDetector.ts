/**
 * Spike Detection Engine
 * Detects price spikes and validates quiet-to-breakout transitions
 */

import { TokenPair, DexScreenerService } from '../services/DexScreenerService';
import { TokenStateManager, TokenSnapshot } from '../data/TokenState';
import { Config } from '../utils/Config';

export interface SpikeAlert {
  tokenAddress: string;
  baseTokenSymbol: string;
  baseTokenName: string;
  pair: TokenPair;
  source: 'pumpfun' | 'bonk';
  tokenAgeHours: number;
  priceChange5m: number;
  tier: 'tier25' | 'tier50';
  currentPrice: number;
  marketCap: number;
  volume5m: number;
  liquidity: number;
  timestamp: number;
}

export class SpikeDetector {
  private tokenStateManager: TokenStateManager;
  private config: Config;
  private dexScreenerService: DexScreenerService;

  constructor(tokenStateManager: TokenStateManager, dexScreenerService: DexScreenerService) {
    this.tokenStateManager = tokenStateManager;
    this.config = Config.getInstance();
    this.dexScreenerService = dexScreenerService;
  }

  /**
   * Check for spike conditions in a token pair
   */
  checkForSpike(pair: TokenPair): SpikeAlert | null {
    const tokenAddress = pair.baseToken.address;

    // Get token source first (hard restriction: only Pump.fun or BONK)
    const source = this.dexScreenerService.getTokenSource(pair);
    if (!source) {
      return null; // Token must be from Pump.fun or BONK
    }

    // Create snapshot from current pair data
    const snapshot: TokenSnapshot = {
      timestamp: Date.now(),
      price: parseFloat(pair.priceUsd) || 0,
      marketCap: pair.fdv || 0,
      volume5m: pair.volume?.['m5'] || 0,
      volume24h: pair.volume?.['h24'] || 0,
      liquidity: pair.liquidity?.usd || 0,
      priceChange5m: pair.priceChange?.['m5'] || 0,
      priceChange24h: pair.priceChange?.['h24'] || 0,
    };

    // Update token state with source
    this.tokenStateManager.updateTokenState(tokenAddress, pair, snapshot, source);

    // Check if token meets criteria
    if (!this.meetsBasicCriteria(pair)) {
      return null;
    }

    // Check if token was in dormant state before the spike
    const wasDormant = this.tokenStateManager.isDormant(
      tokenAddress,
      this.config.dormantVolatilityThreshold,
      this.config.dormantVolumeThreshold,
      this.config.baselinePeriodMinutes
    );

    if (!wasDormant) {
      return null; // Token wasn't dormant, skip
    }

    // Check for spike thresholds
    const priceChange5m = snapshot.priceChange5m;
    let tier: 'tier25' | 'tier50' | null = null;

    // Check tier 50 first (higher priority)
    if (
      this.config.alertThreshold50 &&
      priceChange5m >= 50 &&
      !this.tokenStateManager.isInCooldown(tokenAddress, 'tier50', this.config.alertCooldownMs)
    ) {
      tier = 'tier50';
    }
    // Check tier 25
    else if (
      this.config.alertThreshold25 &&
      priceChange5m >= 25 &&
      priceChange5m < 50 &&
      !this.tokenStateManager.isInCooldown(tokenAddress, 'tier25', this.config.alertCooldownMs)
    ) {
      tier = 'tier25';
    }

    if (!tier) {
      return null; // No spike detected or in cooldown
    }

    // Record alert timestamp
    this.tokenStateManager.recordAlert(tokenAddress, tier);

    // Calculate token age
    const tokenAgeHours = pair.pairCreatedAt 
      ? (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60)
      : 0;

    // Create spike alert
    const alert: SpikeAlert = {
      tokenAddress,
      baseTokenSymbol: pair.baseToken.symbol,
      baseTokenName: pair.baseToken.name,
      pair,
      source,
      tokenAgeHours,
      priceChange5m,
      tier,
      currentPrice: snapshot.price,
      marketCap: snapshot.marketCap,
      volume5m: snapshot.volume5m,
      liquidity: snapshot.liquidity,
      timestamp: snapshot.timestamp,
    };

    return alert;
  }

  /**
   * Check if pair meets basic criteria (market cap, age, etc.)
   */
  private meetsBasicCriteria(pair: TokenPair): boolean {
    // Check market cap
    const marketCap = pair.fdv || 0;
    if (marketCap >= this.config.maxMarketCap || marketCap === 0) {
      return false;
    }

    // Check if pair has price data
    const price = parseFloat(pair.priceUsd || '0');
    if (price <= 0) {
      return false;
    }

    // Spam control: Ignore tokens with liquidity < $2,000 (per requirements section 11)
    // This is a safety check - tokens with 0 liquidity should already be filtered during discovery
    const liquidity = pair.liquidity?.usd || 0;
    if (liquidity < this.config.minLiquidityUsd) {
      return false; // Tokens with 0 liquidity or < $2k are ignored
    }

    return true;
  }

  /**
   * Process multiple pairs and return spike alerts
   */
  checkMultiplePairs(pairs: TokenPair[]): SpikeAlert[] {
    const alerts: SpikeAlert[] = [];

    for (const pair of pairs) {
      try {
        const alert = this.checkForSpike(pair);
        if (alert) {
          alerts.push(alert);
        }
      } catch (error) {
        console.error(`Error checking pair ${pair.pairAddress}:`, error);
      }
    }

    return alerts;
  }
}
