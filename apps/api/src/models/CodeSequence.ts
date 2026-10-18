import { Schema, model } from "mongoose";

const codeSequenceSchema = new Schema({
  _id: { type: String, required: true },
  value: { type: Number, required: true, min: 0, default: 0 }
}, { versionKey: false });

export const CodeSequence = model("CodeSequence", codeSequenceSchema);
