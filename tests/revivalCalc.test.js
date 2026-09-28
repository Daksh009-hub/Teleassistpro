import { describe, it, expect } from 'vitest';
import { calculateRevival } from '../src/utils/revivalCalc';

describe('Auto-Revival Calculator Unit Tests', () => {
  it('calculates revival for 8 months lapsed policy at 8% p.a.', () => {
    const eightMonthsAgo = new Date(Date.now() - 240 * 86400000).toISOString().split('T')[0];
    const res = calculateRevival({
      premiumAmount: 72000,
      lastPaidDate: eightMonthsAgo,
      interestRateAnnual: 8.0
    });

    expect(res.isLapsed).toBe(true);
    expect(res.lapseMonths).toBeCloseTo(7.9, 0.5);
    // Late fee = (72000 * 0.08 * ~7.9) / 12 = ~3780
    expect(res.lateFee).toBeGreaterThan(3500);
    expect(res.lateFee).toBeLessThan(4000);
    expect(res.netPayable).toBe(72000 + res.lateFee);
  });

  it('handles policy within grace period (under 30 days)', () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0];
    const res = calculateRevival({
      premiumAmount: 25000,
      lastPaidDate: twentyDaysAgo,
      interestRateAnnual: 8.0
    });

    expect(res.isLapsed).toBe(false);
    expect(res.lateFee).toBe(0);
    expect(res.netPayable).toBe(25000);
  });

  it('handles invalid or empty inputs gracefully', () => {
    const res = calculateRevival({ premiumAmount: 0, lastPaidDate: null });
    expect(res.isLapsed).toBe(false);
    expect(res.lateFee).toBe(0);
    expect(res.netPayable).toBe(0);
  });
});
