import mongoose, { Schema, models, model } from "mongoose";

const NotificationSchema = new Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["friend_request", "friend_accepted"], required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

export default models.Notification || model("Notification", NotificationSchema);