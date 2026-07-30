import mongoose, { Schema, models, model } from "mongoose";

const AdminSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    sessionToken: { type: String, default: null },
    sessionStartedAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    banCount: { type: Number, default: 0 },
    warningCount: { type: Number, default: 0 },
    deletionCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default models.Admin || model("Admin", AdminSchema);
