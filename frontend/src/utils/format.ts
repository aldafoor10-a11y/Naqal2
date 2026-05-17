/**
 * Formatting helpers
 */
export function formatIQD(amount: number, locale: 'ar' | 'en' = 'ar'): string {
  const formatted = new Intl.NumberFormat('en-US').format(Math.round(amount));
  return locale === 'ar' ? `${formatted} د.ع` : `${formatted} IQD`;
}

export function formatKm(km: number, locale: 'ar' | 'en' = 'ar'): string {
  const v = km.toFixed(1);
  return locale === 'ar' ? `${v} كم` : `${v} km`;
}

export function formatMinutes(mins: number, locale: 'ar' | 'en' = 'ar'): string {
  return locale === 'ar' ? `${mins} دقيقة` : `${mins} min`;
}
