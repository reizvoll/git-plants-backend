import { Request } from 'express';

/**
 * Get the current month and year based on a specific timezone
 * Uses Intl.DateTimeFormat API (Node.js built-in, no external dependencies)
 *
 * @param timezone - IANA timezone identifier (e.g., "Asia/Seoul", "America/New_York")
 * @returns Object containing month (1-12) and year
 *
 * @example
 * getCurrentMonthYear("Asia/Seoul")
 * // Returns: { month: 1, year: 2025 } when it's January 1st in Seoul
 *
 * getCurrentMonthYear("America/New_York")
 * // Returns: { month: 12, year: 2024 } when it's still December 31st in New York
 */
export function getCurrentMonthYear(timezone: string = 'UTC'): { month: number; year: number } {
  const now = new Date();

  try {
    // Use Intl.DateTimeFormat to get date parts in the specified timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
    });

    const parts = formatter.formatToParts(now);
    const yearPart = parts.find(p => p.type === 'year');
    const monthPart = parts.find(p => p.type === 'month');

    if (!yearPart || !monthPart) {
      throw new Error(`Invalid timezone format: ${timezone}`);
    }

    const year = parseInt(yearPart.value);
    const month = parseInt(monthPart.value);

    return { month, year };
  } catch (error) {
    console.error(`Error parsing timezone "${timezone}":`, error);
    // Fallback to UTC if timezone is invalid
    return getCurrentMonthYearUTC();
  }
}

/**
 * Get the current month and year in UTC (fallback)
 */
function getCurrentMonthYearUTC(): { month: number; year: number } {
  const now = new Date();
  return {
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear(),
  };
}

/**
 * Extract timezone from Express request headers
 * Looks for X-Timezone header, falls back to UTC if not found
 *
 * @param req - Express request object
 * @returns IANA timezone identifier
 *
 * @example
 * // Client sends: X-Timezone: Asia/Seoul
 * getTimezoneFromRequest(req) // Returns: "Asia/Seoul"
 *
 * // No header sent
 * getTimezoneFromRequest(req) // Returns: "UTC"
 */
export function getTimezoneFromRequest(req: Request): string {
  const timezone = req.headers['x-timezone'] as string | undefined;

  // Validate timezone format (basic check)
  if (timezone && typeof timezone === 'string' && timezone.includes('/')) {
    return timezone;
  }

  return 'UTC';
}

/**
 * Get current month and year from request's timezone header
 * Convenience function combining getTimezoneFromRequest + getCurrentMonthYear
 *
 * @param req - Express request object
 * @returns Object containing month (1-12) and year based on user's timezone
 *
 * @example
 * // Client in Korea (KST, UTC+9) at 2025-01-01 00:30 KST
 * // UTC time: 2024-12-31 15:30
 * getMonthYearFromRequest(req) // Returns: { month: 1, year: 2025 }
 *
 * // Client in New York (EST, UTC-5) at same UTC moment
 * getMonthYearFromRequest(req) // Returns: { month: 12, year: 2024 }
 */
export function getMonthYearFromRequest(req: Request): { month: number; year: number } {
  const timezone = getTimezoneFromRequest(req);
  return getCurrentMonthYear(timezone);
}
