export type PaymentFilter = 'all' | 'card' | 'cash' | 'other';
/** Only explicitly identified cash is cash; OTHER must not be inferred as cash. */
export function matchesPayment(method: unknown, filter: PaymentFilter): boolean {
  if (filter === 'all') return true;
  const value = typeof method === 'string' ? method.trim().toUpperCase() : '';
  const card = value === 'CREDIT' || value === 'DEBIT';
  const cash = value === 'CASH';
  return filter === 'card' ? card : filter === 'cash' ? cash : !card && !cash;
}
