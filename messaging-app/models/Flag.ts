import mongoose, { Schema, models, model } from "mongoose";

const FlagSchema = new Schema(
  {
    message: { type: mongoose.Schema.Types.ObjectId, ref: "Message", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    matchedTerms: { type: [String], default: [] },
    reviewed: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null, index: true },
  },
  { timestamps: true }
);

FlagSchema.index({ reviewed: 1, createdAt: -1 });

export default models.Flag || model("Flag", FlagSchema);
