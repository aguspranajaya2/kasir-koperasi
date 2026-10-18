import { Schema, model } from "mongoose";

const auditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  action: { type: String, required: true, maxlength: 80 },
  entity: { type: String, required: true, maxlength: 80 },
  entityId: { type: String, required: true, maxlength: 100 },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
}, { versionKey: false });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
export const AuditLog = model("AuditLog", auditLogSchema);
