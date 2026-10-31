/**
 * University UI Formatters & Helpers
 */

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getRiskBadgeClasses(risk: string): { bg: string; text: string; border: string } {
  switch (risk) {
    case 'SAFE':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'WARNING':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'HIGH_RISK':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
    case 'CRITICAL':
    default:
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
  }
}

export function getStatusBadgeClasses(status: string): { bg: string; text: string; border: string } {
  switch (status) {
    case 'PRESENT':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-200' };
    case 'LATE':
      return { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-200' };
    case 'ABSENT':
    default:
      return { bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-200' };
  }
}

export function formatOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

