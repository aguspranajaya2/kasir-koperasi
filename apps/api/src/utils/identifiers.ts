import type { Model } from "mongoose";
import { CodeSequence } from "../models/CodeSequence.js";

async function currentSequence(model: Model<any>, field: string, prefix: string) {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const latest = await model.findOne({ [field]: pattern }).sort({ [field]: -1 }).select(field).lean() as Record<string, string> | null;
  const parsed = Number(latest?.[field]?.slice(prefix.length + 1));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

const formatCode = (prefix: string, value: number) => `${prefix}-${String(value).padStart(4, "0")}`;

export async function previewCode(key: string, prefix: string, model: Model<any>, field: string) {
  const [existing, counter] = await Promise.all([
    currentSequence(model, field, prefix),
    CodeSequence.findById(key).select("value").lean()
  ]);
  return formatCode(prefix, Math.max(existing, counter?.value ?? 0) + 1);
}

export async function allocateCode(key: string, prefix: string, model: Model<any>, field: string) {
  const existing = await currentSequence(model, field, prefix);
  const pipeline = [
    {
      $set: {
        value: {
          $add: [
            { $max: [{ $ifNull: ["$value", 0] }, existing] },
            1
          ]
        }
      }
    }
  ];
  const counter = await CodeSequence.findOneAndUpdate(
    { _id: key },
    pipeline,
    { new: true, upsert: true }
  );
  return formatCode(prefix, counter!.value);
}
