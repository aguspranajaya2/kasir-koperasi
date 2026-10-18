import type { ClientSession } from "mongoose";
import { AuditLog } from "../models/AuditLog.js";

export async function writeAudit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
  session?: ClientSession
): Promise<void> {
  const record = [{
    actorId,
    action,
    entity,
    entityId,
    metadata,
    createdAt: new Date()
  }];
  if (session) await AuditLog.create(record, { session });
  else await AuditLog.create(record);
}
