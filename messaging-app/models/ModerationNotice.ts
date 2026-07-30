import mongoose, { Schema, models, model } from "mongoose";

const ModerationNoticeSchema = new Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["warning", "ban"], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    reason: { type: String, default: "" },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    appealSubmitted: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    dismissed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ModerationNoticeSchema.index({ recipient: 1, createdAt: -1 });

export default models.ModerationNotice || model("ModerationNotice", ModerationNoticeSchema);
