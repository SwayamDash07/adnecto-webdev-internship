import mongoose, { Schema, models, model } from "mongoose";

const ConversationSchema = new Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    type: { type: String, enum: ["direct", "group"], default: "direct" },
    name: { type: String, default: "", trim: true, maxlength: 80 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    avatarUrl: { type: String, default: "", trim: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    moderationMode: { type: String, enum: ["all", "none"], default: "all" },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ConversationSchema.index({ participants: 1 });

export default models.Conversation || model("Conversation", ConversationSchema);
