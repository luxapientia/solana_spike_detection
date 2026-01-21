import { 
  getPairsByTokenAddresses, 
  searchPairs,
  Pair,
  PairsResponse 
} from 'dexscreener-sdk';

/**
 * Type alias for Pair from the SDK
 */
export type TokenPair = Pair;

/**
 * Service for interacting with DexScreener API
 */
export class DexScreenerService {
  private readonly SOLANA_CHAIN_ID = 'solana';
  private readonly MAX_MARKET_CAP = 100000; // $100k as per requirements

  constructor() {
    // SDK uses static functions, no client instance needed
  }

  /**
   * Get token pairs for a specific Solana token address
   * @param tokenAddress - The Solana token address
   * @returns Array of token pairs
   */
  async getTokenPairs(tokenAddress: string): Promise<TokenPair[]> {
    try {
      const pairs = await getPairsByTokenAddresses(this.SOLANA_CHAIN_ID, tokenAddress);
      
      if (!pairs || pairs.length === 0) {
        return [];
      }

      // All pairs returned are already for the specified chain
      return pairs;
    } catch (error) {
      console.error(`Error fetching pairs for token ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get token pairs for multiple Solana token addresses (bulk lookup)
   * @param tokenAddresses - Array of Solana token addresses (max 30)
   * @returns Array of token pairs
   */
  async getMultipleTokenPairs(tokenAddresses: string[]): Promise<TokenPair[]> {
    try {
      // DexScreener allows up to 30 addresses per request (comma-separated string)
      const batchSize = 30;
      const allPairs: TokenPair[] = [];

      for (let i = 0; i < tokenAddresses.length; i += batchSize) {
        const batch = tokenAddresses.slice(i, i + batchSize);
        const addressesString = batch.join(',');
        const pairs = await getPairsByTokenAddresses(this.SOLANA_CHAIN_ID, addressesString);
        
        if (pairs && pairs.length > 0) {
          allPairs.push(...pairs);
        }

        // Rate limit protection: wait 200ms between batches
        if (i + batchSize < tokenAddresses.length) {
          await this.delay(200);
        }
      }

      return allPairs;
    } catch (error) {
      console.error('Error fetching multiple token pairs:', error);
      throw error;
    }
  }

  /**
   * Search for pairs matching a query (useful for finding Pump/Bonk tokens)
   * @param query - Search query (e.g., token symbol or name)
   * @returns Array of matching token pairs
   */
  async searchPairs(query: string): Promise<TokenPair[]> {
    try {
      const response: PairsResponse = await searchPairs(query);
      
      if (!response || !response.pairs) {
        return [];
      }

      // Filter for Solana pairs only
      const solanaPairs = response.pairs.filter(
        (pair) => pair.chainId === this.SOLANA_CHAIN_ID
      );

      return solanaPairs;
    } catch (error) {
      console.error(`Error searching pairs for query "${query}":`, error);
      throw error;
    }
  }

  /**
   * Get the primary (highest liquidity) pair for a token
   * @param tokenAddress - The Solana token address
   * @returns The primary token pair or null
   */
  async getPrimaryPair(tokenAddress: string): Promise<TokenPair | null> {
    const pairs = await this.getTokenPairs(tokenAddress);
    
    if (pairs.length === 0) {
      return null;
    }

    // Return the pair with highest liquidity
    return pairs.reduce((prev, current) => {
      const prevLiquidity = prev.liquidity?.usd || 0;
      const currentLiquidity = current.liquidity?.usd || 0;
      return currentLiquidity > prevLiquidity ? current : prev;
    });
  }

  /**
   * Filter pairs by market cap (FDV - Fully Diluted Valuation)
   * @param pairs - Array of token pairs
   * @param maxMarketCap - Maximum market cap in USD (default: $100k)
   * @returns Filtered array of pairs
   */
  filterByMarketCap(pairs: TokenPair[], maxMarketCap: number = this.MAX_MARKET_CAP): TokenPair[] {
    return pairs.filter(pair => {
      const marketCap = pair.fdv || 0;
      return marketCap > 0 && marketCap < maxMarketCap;
    });
  }

  /**
   * Filter pairs by minimum age
   * @param pairs - Array of token pairs
   * @param minAgeHours - Minimum age in hours
   * @returns Filtered array of pairs
   */
  filterByAge(pairs: TokenPair[], minAgeHours: number): TokenPair[] {
    const minAgeMs = minAgeHours * 60 * 60 * 1000;
    const now = Date.now();

    return pairs.filter(pair => {
      if (!pair.pairCreatedAt) {
        return false; // Skip pairs without creation timestamp
      }
      const age = now - pair.pairCreatedAt;
      return age >= minAgeMs;
    });
  }

  /**
   * Check if a token is from Pump.fun or BONK launchpad (hard restriction)
   * @param pair - Token pair to check
   * @returns 'pumpfun' | 'bonk' | null
   */
  getTokenSource(pair: TokenPair): 'pumpfun' | 'bonk' | null {
    // Check dexId for launchpad identifiers
    const dexId = (pair.dexId || '').toLowerCase();
    
    if (dexId.includes('pump')) {
      return 'pumpfun';
    }
    
    if (dexId.includes('bonk')) {
      return 'bonk';
    }
    
    return null;
  }

  /**
   * Check if a token is from Pump.fun or BONK launchpad
   * @param pair - Token pair to check
   * @returns True if token is from Pump.fun or BONK
   */
  isFromPumpOrBonk(pair: TokenPair): boolean {
    return this.getTokenSource(pair) !== null;
  }

  /**
   * Get 5-minute price change percentage
   * @param pair - Token pair
   * @returns Price change percentage in last 5 minutes
   */
  getPriceChange5m(pair: TokenPair): number {
    return pair.priceChange?.['m5'] || 0;
  }

  /**
   * Get current price in USD
   * @param pair - Token pair
   * @returns Price in USD
   */
  getPriceUsd(pair: TokenPair): number {
    return parseFloat(pair.priceUsd) || 0;
  }

  /**
   * Get market cap (FDV)
   * @param pair - Token pair
   * @returns Market cap in USD
   */
  getMarketCap(pair: TokenPair): number {
    return pair.fdv || 0;
  }

  /**
   * Get 5-minute volume
   * @param pair - Token pair
   * @returns Volume in USD for last 5 minutes
   */
  getVolume5m(pair: TokenPair): number {
    return pair.volume?.['m5'] || 0;
  }

  /**
   * Get DexScreener URL for a pair
   * @param pair - Token pair
   * @returns DexScreener URL
   */
  getDexScreenerUrl(pair: TokenPair): string {
    return pair.url || `https://dexscreener.com/solana/${pair.pairAddress}`;
  }

  /**
   * Get Jupiter swap URL for a token
   * @param tokenAddress - Token address
   * @returns Jupiter swap URL
   */
  getJupiterUrl(tokenAddress: string): string {
    return `https://jup.ag/tokens/${tokenAddress}`;
  }

  /**
   * Helper method to delay execution (for rate limiting)
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
