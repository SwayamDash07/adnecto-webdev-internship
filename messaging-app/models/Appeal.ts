import mongoose, { Schema, models, model } from "mongoose";

const AppealSchema = new Schema(
  {
    notice: { type: mongoose.Schema.Types.ObjectId, ref: "ModerationNotice", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ["pending", "approved", "denied"], default: "pending" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AppealSchema.index({ status: 1, createdAt: -1 });
AppealSchema.index({ user: 1, notice: 1, status: 1 });

export default models.Appeal || model("Appeal", AppealSchema);
