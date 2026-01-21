/**
 * Token Universe Manager
 * Discovers and maintains a list of eligible tokens from Pump and Bonk launchpads
 */

import { DexScreenerService, TokenPair } from '../services/DexScreenerService';
import { Config } from '../utils/Config';

export class TokenUniverseManager {
  private dexScreenerService: DexScreenerService;
  private config: Config;
  private trackedTokens: Set<string> = new Set();

  constructor(dexScreenerService: DexScreenerService) {
    this.dexScreenerService = dexScreenerService;
    this.config = Config.getInstance();
  }

  /**
   * Discover new tokens from Pump.fun and BONK launchpads (hard restriction)
   * This searches for pairs that might be from these launchpads
   */
  async discoverTokens(): Promise<string[]> {
    const discoveredTokens: string[] = [];

    try {
      // Search for Pump.fun tokens
      // Note: DexScreener search for "pumpfun" should return Pump.fun tokens
      // The filterEligiblePairs() will verify via dexId to ensure hard restriction
      try {
        const pumpfunPairs = await this.dexScreenerService.searchPairs('pumpfun');
        const eligiblePairs = this.filterEligiblePairs(pumpfunPairs);

        for (const pair of eligiblePairs) {
          const address = pair.baseToken.address;
          // Double-check: ensure source is verified Pump.fun (hard restriction)
          const source = this.dexScreenerService.getTokenSource(pair);
          if (source === 'pumpfun' && !this.trackedTokens.has(address)) {
            discoveredTokens.push(address);
            this.trackedTokens.add(address);
          }
        }

        // Rate limit protection
        await this.delay(500);
      } catch (error) {
        console.error('Error searching for Pump.fun tokens:', error);
      }

      // Search for BONK tokens
      // The filterEligiblePairs() will verify via dexId to ensure hard restriction
      try {
        const bonkPairs = await this.dexScreenerService.searchPairs('bonk');
        const eligiblePairs = this.filterEligiblePairs(bonkPairs);

        for (const pair of eligiblePairs) {
          const address = pair.baseToken.address;
          // Double-check: ensure source is verified BONK (hard restriction)
          const source = this.dexScreenerService.getTokenSource(pair);
          if (source === 'bonk' && !this.trackedTokens.has(address)) {
            discoveredTokens.push(address);
            this.trackedTokens.add(address);
          }
        }

        // Rate limit protection
        await this.delay(500);
      } catch (error) {
        console.error('Error searching for BONK tokens:', error);
      }
    } catch (error) {
      console.error('Error in discoverTokens:', error);
    }

    return discoveredTokens;
  }

  /**
   * Filter pairs based on eligibility criteria
   * Per requirements: tokens with liquidity < $2,000 must be ignored
   */
  private filterEligiblePairs(pairs: TokenPair[]): TokenPair[] {
    return pairs.filter((pair) => {
      // Check market cap
      const marketCap = pair.fdv || 0;
      if (marketCap >= this.config.maxMarketCap || marketCap === 0) {
        return false;
      }

      // Hard restriction: Only Pump.fun and BONK tokens allowed
      if (!this.dexScreenerService.isFromPumpOrBonk(pair)) {
        return false;
      }

      // Check if pair has necessary data
      if (!pair.priceUsd || parseFloat(pair.priceUsd) <= 0) {
        return false;
      }

      // Spam control: Ignore tokens with liquidity < $2,000 (per requirements section 11)
      const liquidity = pair.liquidity?.usd || 0;
      if (liquidity < this.config.minLiquidityUsd) {
        return false; // Tokens with 0 liquidity or < $2k are ignored
      }

      // Check age if pair creation timestamp is available
      if (pair.pairCreatedAt) {
        const ageHours = (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60);
        if (ageHours < this.config.minTokenAgeHours) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Add token to tracking list
   */
  addToken(tokenAddress: string): void {
    this.trackedTokens.add(tokenAddress);
  }

  /**
   * Remove token from tracking list
   */
  removeToken(tokenAddress: string): void {
    this.trackedTokens.delete(tokenAddress);
  }

  /**
   * Get all tracked token addresses
   */
  getTrackedTokens(): string[] {
    return Array.from(this.trackedTokens);
  }

  /**
   * Check if token is being tracked
   */
  isTracked(tokenAddress: string): boolean {
    return this.trackedTokens.has(tokenAddress);
  }

  /**
   * Update token eligibility (re-check filters)
   */
  async updateTokenEligibility(tokenAddress: string): Promise<boolean> {
    try {
      const pairs = await this.dexScreenerService.getTokenPairs(tokenAddress);
      const eligiblePairs = this.filterEligiblePairs(pairs);

      if (eligiblePairs.length > 0) {
        if (!this.trackedTokens.has(tokenAddress)) {
          this.trackedTokens.add(tokenAddress);
        }
        return true;
      } else {
        // Token no longer meets criteria
        this.trackedTokens.delete(tokenAddress);
        return false;
      }
    } catch (error) {
      console.error(`Error updating eligibility for ${tokenAddress}:`, error);
      return false;
    }
  }

  /**
   * Get count of tracked tokens
   */
  getTrackedTokenCount(): number {
    return this.trackedTokens.size;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
