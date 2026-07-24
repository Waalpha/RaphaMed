import { Hospital } from '../types';

export interface PaymentCheckResult {
  isPaused: boolean;
  reason: string;
  dueDate: number; // Day 5 of month
  currentDay: number;
  currentMonthStr: string; // YYYY-MM
  isPaidCurrentMonth: boolean;
  hasOverride: boolean;
  statusType: 'PAID' | 'PAUSED_UNPAID' | 'OVERRIDE_ACTIVE' | 'DUE_SOON';
}

/**
 * Checks if a hospital branch project is paused due to unpaid subscription fee on or after the 5th of the month.
 *
 * Rules:
 * 1. Monthly subscription is due on the 5th of every month.
 * 2. If current date >= 5th of month AND payment for current month is NOT recorded:
 *    - If Super Admin override is enabled (paymentOverride === true) -> ALLOW CONTINUATION (Not paused).
 *    - Otherwise -> PAUSE PROJECT WORKSPACE for non-Super-Admin users.
 * 3. Only Super Admin can record payment or set continuation override.
 */
export function checkHospitalPaymentStatus(
  hospital: Hospital | null | undefined,
  simulatedDate?: Date
): PaymentCheckResult {
  const now = simulatedDate || new Date();
  const currentDay = now.getDate();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const currentMonthStr = `${year}-${month}`;
  const dueDate = 5; // 5th of every month

  if (!hospital) {
    return {
      isPaused: false,
      reason: '',
      dueDate,
      currentDay,
      currentMonthStr,
      isPaidCurrentMonth: false,
      hasOverride: false,
      statusType: 'DUE_SOON'
    };
  }

  const isPaidCurrentMonth =
    hospital.lastPaymentMonth === currentMonthStr && hospital.paymentStatus === 'Paid';
  const hasOverride = Boolean(hospital.paymentOverride);

  // If Super Admin override is set to allow continuation
  if (hasOverride) {
    return {
      isPaused: false,
      reason: hospital.paymentOverrideNote || 'Super Admin continuation override active.',
      dueDate,
      currentDay,
      currentMonthStr,
      isPaidCurrentMonth,
      hasOverride: true,
      statusType: 'OVERRIDE_ACTIVE'
    };
  }

  // If today is on or after the 5th of the month and payment for current month is NOT paid
  if (currentDay >= dueDate && !isPaidCurrentMonth) {
    return {
      isPaused: true,
      reason: `Project paused: Monthly subscription payment for ${currentMonthStr} was due on the 5th of the month and has not been received.`,
      dueDate,
      currentDay,
      currentMonthStr,
      isPaidCurrentMonth: false,
      hasOverride: false,
      statusType: 'PAUSED_UNPAID'
    };
  }

  // Before the 5th or already paid
  if (isPaidCurrentMonth) {
    return {
      isPaused: false,
      reason: `Monthly subscription paid for ${currentMonthStr}.`,
      dueDate,
      currentDay,
      currentMonthStr,
      isPaidCurrentMonth: true,
      hasOverride: false,
      statusType: 'PAID'
    };
  }

  // Before 5th of month and unpaid
  return {
    isPaused: false,
    reason: `Subscription payment due on 5th of ${currentMonthStr}.`,
    dueDate,
    currentDay,
    currentMonthStr,
    isPaidCurrentMonth: false,
    hasOverride: false,
    statusType: 'DUE_SOON'
  };
}

/**
 * Returns formatted month name e.g. "July 2026"
 */
export function formatMonthString(monthStr: string): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [yearStr, monthNumStr] = monthStr.split('-');
  const date = new Date(parseInt(yearStr, 10), parseInt(monthNumStr, 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
