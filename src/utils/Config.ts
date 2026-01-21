/**
 * Configuration Manager
 * Manages bot settings with runtime updates via Telegram commands
 */

export interface BotConfig {
  // Alert thresholds
  alertThreshold25: boolean;
  alertThreshold50: boolean;

  // Token filters
  minTokenAgeHours: number;
  maxMarketCap: number;

  // Bot state
  isPaused: boolean;

  // Polling configuration
  pollingIntervalMs: number;

  // Dormant detection thresholds
  dormantVolatilityThreshold: number; // Max price change % to be considered dormant
  dormantVolumeThreshold: number; // Max volume USD in baseline period
  baselinePeriodMinutes: number; // Period to check for dormant state

  // Cooldown settings (in milliseconds)
  alertCooldownMs: number; // Cooldown between alerts for same token/tier
}

export class Config {
  private static instance: Config;
  private config: BotConfig;

  private constructor() {
    // Initialize with defaults
    this.config = {
      alertThreshold25: process.env.ALERT_THRESHOLD_25 !== 'false',
      alertThreshold50: process.env.ALERT_THRESHOLD_50 !== 'false',
      minTokenAgeHours: parseInt(process.env.MIN_TOKEN_AGE_HOURS || '1', 10),
      maxMarketCap: parseInt(process.env.MAX_MARKET_CAP || '100000000', 10),
      isPaused: false,
      pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '10000', 10), // 1 minute default
      dormantVolatilityThreshold: 5, // Max 5% price change to be considered dormant
      dormantVolumeThreshold: 1000, // Max $1k volume in baseline period
      baselinePeriodMinutes: 60, // Check last 60 minutes for dormant state
      alertCooldownMs: 30 * 60 * 1000, // 30 minutes cooldown
    };
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  getConfig(): Readonly<BotConfig> {
    return { ...this.config };
  }

  updateConfig(updates: Partial<BotConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // Convenience getters
  get alertThreshold25(): boolean {
    return this.config.alertThreshold25;
  }

  get alertThreshold50(): boolean {
    return this.config.alertThreshold50;
  }

  get minTokenAgeHours(): number {
    return this.config.minTokenAgeHours;
  }

  get maxMarketCap(): number {
    return this.config.maxMarketCap;
  }

  get isPaused(): boolean {
    return this.config.isPaused;
  }

  get pollingIntervalMs(): number {
    return this.config.pollingIntervalMs;
  }

  get dormantVolatilityThreshold(): number {
    return this.config.dormantVolatilityThreshold;
  }

  get dormantVolumeThreshold(): number {
    return this.config.dormantVolumeThreshold;
  }

  get baselinePeriodMinutes(): number {
    return this.config.baselinePeriodMinutes;
  }

  get alertCooldownMs(): number {
    return this.config.alertCooldownMs;
  }

  pause(): void {
    this.config.isPaused = true;
  }

  resume(): void {
    this.config.isPaused = false;
  }

  setMinTokenAge(hours: number): void {
    if (hours < 0) {
      throw new Error('Minimum token age must be non-negative');
    }
    this.config.minTokenAgeHours = hours;
  }

  setAlertThreshold(tier: '25' | '50', enabled: boolean): void {
    if (tier === '25') {
      this.config.alertThreshold25 = enabled;
    } else {
      this.config.alertThreshold50 = enabled;
    }
  }

  /**
   * Format config for display in Telegram
   */
  formatForDisplay(): string {
    const status = this.config.isPaused ? '⏸ PAUSED' : '▶️ RUNNING';
    const thresholds = [];
    if (this.config.alertThreshold25) thresholds.push('+25%');
    if (this.config.alertThreshold50) thresholds.push('+50%');

    return `
🤖 Bot Status: ${status}

📊 Alert Thresholds: ${thresholds.length > 0 ? thresholds.join(', ') : 'None enabled'}

⚙️ Configuration:
• Min Token Age: ${this.config.minTokenAgeHours}h
• Max Market Cap: $${this.config.maxMarketCap.toLocaleString()}
• Polling Interval: ${this.config.pollingIntervalMs / 1000}s

🔍 Dormant Detection:
• Volatility Threshold: ${this.config.dormantVolatilityThreshold}%
• Volume Threshold: $${this.config.dormantVolumeThreshold.toLocaleString()}
• Baseline Period: ${this.config.baselinePeriodMinutes} minutes
• Alert Cooldown: ${this.config.alertCooldownMs / 60000} minutes
    `.trim();
  }
}
