import { getDb } from '../config/db';
import { getRedis, keys } from '../config/redis';

interface FraudInput {
  userId:        string;
  fromAccountId: string;
  toAccountId?:  string;
  amount:        number;
  ip:            string;
  txType?:       string;
}

export interface FraudResult {
  score:    number;
  flagged:  boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  rule:     string;
}

export async function runFraudCheck(input: FraudInput): Promise<FraudResult> {
  const redis = getRedis();
  const db    = getDb();
  let   score = 0;
  const rules: string[] = [];

  // Rule 1: More than 3 transfers in 5 minutes
  const rapidKey   = keys.fraud(input.userId);
  const rapidCount = await redis.incr(rapidKey);
  await redis.expire(rapidKey, 300);
  if (rapidCount > 3) { score += 40; rules.push('rapid_transfer'); }

  // Rule 2: Amount over $5,000
  if (input.amount > 5000) { score += 25; rules.push('large_amount'); }

  // Rule 3: New IP address
  const lastIpKey = keys.lastIp(input.userId);
  const lastIp    = await redis.get(lastIpKey);
  if (lastIp && lastIp !== input.ip) { score += 15; rules.push('new_ip'); }
  await redis.setEx(lastIpKey, 86400, input.ip);

  // Rule 4: Daily velocity over $10,000
  const { rows: [vel] } = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE from_account_id = $1
       AND status = 'completed'
       AND created_at > NOW() - INTERVAL '24 hours'`,
    [input.fromAccountId]
  );
  if (parseFloat(vel.total) + input.amount > 10000) {
    score += 20;
    rules.push('daily_velocity');
  }

  score = Math.min(score, 100);
  const flagged  = score >= 60;
  const severity = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';

  return { score, flagged, severity: severity as FraudResult['severity'], rule: rules.join(',') || 'none' };
}
