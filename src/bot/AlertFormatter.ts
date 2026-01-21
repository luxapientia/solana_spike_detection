/**
 * Alert Formatter
 * Formats spike alerts for Telegram messages
 */

import { SpikeAlert } from '../detector/SpikeDetector';
import { DexScreenerService } from '../services/DexScreenerService';

export class AlertFormatter {
  private dexScreenerService: DexScreenerService;

  constructor(dexScreenerService: DexScreenerService) {
    this.dexScreenerService = dexScreenerService;
  }

  /**
   * Format spike alert for Telegram (per requirements section 10.2)
   */
  formatAlert(alert: SpikeAlert): string {
    const emoji = alert.tier === 'tier50' ? '🚨🚨' : '🚨';
    const tierText = alert.tier === 'tier50' ? '+50% SPIKE' : '+25% SPIKE';
    const priceChangeSign = alert.priceChange5m >= 0 ? '+' : '';

    const dexScreenerUrl = this.dexScreenerService.getDexScreenerUrl(alert.pair);
    const jupiterUrl = this.dexScreenerService.getJupiterUrl(alert.tokenAddress);

    const timestamp = new Date(alert.timestamp).toLocaleString();
    
    // Format token age
    let ageText = '';
    if (alert.tokenAgeHours < 24) {
      ageText = `${alert.tokenAgeHours.toFixed(1)}h`;
    } else {
      const ageDays = alert.tokenAgeHours / 24;
      ageText = `${ageDays.toFixed(1)}d`;
    }

    // Format source (capitalize first letter)
    const sourceText = alert.source === 'pumpfun' ? 'Pump.fun' : 'BONK';

    return `
${emoji} <b>${tierText} DETECTED</b> ${emoji}

🪙 <b>Token:</b> ${alert.baseTokenName} (${alert.baseTokenSymbol})
📍 <b>Mint:</b> <code>${alert.tokenAddress}</code>
🏷️ <b>Source:</b> ${sourceText}
⏰ <b>Age:</b> ${ageText}

💰 <b>Price:</b> $${alert.currentPrice.toFixed(8)}
📈 <b>Price Change:</b> ${priceChangeSign}${alert.priceChange5m.toFixed(2)}% (5 min)

💵 <b>Market Cap:</b> $${alert.marketCap.toLocaleString()}
💧 <b>Liquidity:</b> $${alert.liquidity.toLocaleString()}
📊 <b>Volume Spike (5m):</b> $${alert.volume5m.toLocaleString()}

🔗 <b>Links:</b>
<a href="${jupiterUrl}">Jupiter</a> | <a href="${dexScreenerUrl}">DexScreener</a>

⏰ ${timestamp}
    `.trim();
  }

  /**
   * Format multiple alerts (if multiple spikes detected)
   */
  formatMultipleAlerts(alerts: SpikeAlert[]): string {
    if (alerts.length === 0) return '';
    if (alerts.length === 1) return this.formatAlert(alerts[0]);

    let message = `🚨 <b>${alerts.length} SPIKES DETECTED</b> 🚨\n\n`;

    alerts.forEach((alert, index) => {
      const emoji = alert.tier === 'tier50' ? '🚨🚨' : '🚨';
      message += `${emoji} <b>${index + 1}. ${alert.baseTokenSymbol}</b>\n`;
      message += `   Price: $${alert.currentPrice.toFixed(8)}\n`;
      message += `   Change: +${alert.priceChange5m.toFixed(2)}%\n`;
      message += `   <a href="${this.dexScreenerService.getDexScreenerUrl(alert.pair)}">DexScreener</a>\n\n`;
    });

    return message.trim();
  }
}
