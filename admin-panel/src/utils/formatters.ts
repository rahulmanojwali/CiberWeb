export function formatMongoDecimal(value: any): string {
  if (value === null || value === undefined || value === '') return '-';

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : value;
  }

  if (typeof value === 'object') {
    const candidates = [
      value.$numberDecimal,
      value.$numberDouble,
      value.$numberInt,
      value.$numberLong,
      value.value,
      value.amount,
    ];

    for (const candidate of candidates) {
      if (candidate !== null && candidate !== undefined) {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) {
          return parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
      }
    }

    if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
      const parsed = Number(value.toString());
      if (Number.isFinite(parsed)) {
        return parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
  }

  return '-';
}

export function formatCurrencyINR(value: any): string {
  const formatted = formatMongoDecimal(value);
  return formatted === '-' ? '-' : `₹${formatted}`;
}

export function formatDateTime(value: any): string {
  return formatBusinessDateTime(value);
}

export function formatBusinessDateTime(value: any, timezone?: string, locale = 'en-IN'): string {
  if (!value) return '-';

  const raw = typeof value === 'object' && value.$date ? value.$date : value;
  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString(locale, {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function safeText(value: any): string {
  if (value === null || value === undefined || value === '') return '-';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    if (value.name) return String(value.name);
    if (value.label) return String(value.label);
    if (value.code) return String(value.code);
    if (value.username) return String(value.username);
    if (value.$oid) return String(value.$oid);
  }

  return '-';
}
