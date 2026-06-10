import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';

export function generateRef(): string {
  const date  = dayjs().format('YYYYMMDD');
  const token = uuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `TXN-${date}-${token}`;
}

export function generateAccountNumber(): string {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export function calcMonthlyPayment(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}
