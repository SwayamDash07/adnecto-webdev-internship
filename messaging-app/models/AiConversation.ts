import mongoose, { Schema, models, model } from "mongoose";

const AiMessageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, trim: true, maxlength: 12000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const AiConversationSchema = new Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    messages: { type: [AiMessageSchema], default: [] },
  },
  { timestamps: true }
);

export default models.AiConversation || model("AiConversation", AiConversationSchema);
