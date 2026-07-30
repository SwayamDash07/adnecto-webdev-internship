import mongoose, { Schema, models, model } from "mongoose";

const FriendRequestSchema = new Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
  },
  { timestamps: true }
);

FriendRequestSchema.index({ from: 1, to: 1, status: 1 });

export default models.FriendRequest || model("FriendRequest", FriendRequestSchema);