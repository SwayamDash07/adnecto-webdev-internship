import mongoose, { Schema, models, model } from "mongoose";

const MessageSchema = new Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: null },
    deliveredAt: { type: Date, default: Date.now },
    hiddenFrom: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deleted: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

MessageSchema.index({ conversation: 1, createdAt: 1 });

export default models.Message || model("Message", MessageSchema);
