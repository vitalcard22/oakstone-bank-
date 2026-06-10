import { getDb } from '../config/db';

interface AuditEntry {
  actorId:     string;
  action:      string;
  entityType?: string;
  entityId?:   string;
  metadata?:   object;
  ip?:         string;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await getDb().query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        entry.actorId,
        entry.action,
        entry.entityType ?? null,
        entry.entityId ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.ip ?? null,
      ]
    );
  } catch (e) {
    console.error('[AuditLog] failed:', e);
  }
}
