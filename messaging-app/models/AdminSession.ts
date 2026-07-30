import mongoose, { Schema, models, model } from "mongoose";

const AdminSessionSchema = new Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    action: { type: String, enum: ["login", "logout", "username_change", "password_change"], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AdminSessionSchema.index({ adminId: 1, createdAt: -1 });

export default models.AdminSession || model("AdminSession", AdminSessionSchema);
