import mongoose, { Schema, models, model } from "mongoose";

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    sessionToken: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    location: { type: String, default: "", trim: true },
    hobbies: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    musicTaste: { type: String, default: "", trim: true },
    movieTaste: { type: String, default: "", trim: true },
    favoriteFood: { type: String, default: "", trim: true },
    bio: { type: String, default: "", trim: true },
    personalNote: { type: String, default: "", trim: true },
    warningCount: { type: Number, default: 0 },
    warningHistory: [
      {
        _id: false,
        reason: { type: String, default: "" },
        admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    bannedUntil: { type: Date, default: null },
    bannedPermanently: { type: Boolean, default: false },
    avatarUrl: { type: String, default: "", trim: true },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    personalChatModeration: { type: String, enum: ["strangers", "all", "none"], default: "all" },
    readReceipts: [
      {
        _id: false,
        conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
        lastReadAt: { type: Date, default: Date.now },
      },
    ],
    mutedConversations: [
      {
        _id: false,
        conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
        mutedUntil: { type: Date, default: null },
      },
    ],
  },
  { timestamps: true }
);

UserSchema.index({ sessionToken: 1 });

export default models.User || model("User", UserSchema);
