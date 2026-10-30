export function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'UTC', timeZoneName: 'short',
    }).format(new Date(iso));
  } catch { return iso; }
}

export function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    }).format(new Date(iso));
  } catch { return ''; }
}

export function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function confidenceLabel(score: number): { label: string; color: string } {
  if (score >= 0.8)  return { label: 'High',   color: '#2d6a4f' };
  if (score >= 0.55) return { label: 'Medium', color: '#b8860b' };
  return               { label: 'Low',    color: '#c0392b' };
}

export function evidenceTypeIcon(type: string): string {
  return { image: '🖼', video: '🎬', document: '📄', sensor: '📡' }[type] ?? '📦';
}

export function truncate(str: string, n: number): string {
  return str.length <= n ? str : str.slice(0, n - 1) + '…';
}
