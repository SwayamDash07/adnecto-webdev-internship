import mongoose, { Schema, models, model } from "mongoose";

const ExperienceSchema = new Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  duration: { type: String, required: true },
  description: { type: String, default: "" },
});

const EducationSchema = new Schema({
  degree: { type: String, required: true },
  institution: { type: String, required: true },
  duration: { type: String, required: true },
  description: { type: String, default: "" },
});

const ProjectSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  link: { type: String, default: "" },
});

const UserSchema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    dob: { type: Date, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    sessionToken: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    bio: { type: String, default: "" },
    skills: { type: [String], default: [] },
    profilePicture: { type: String, default: "" },
    experience: { type: [ExperienceSchema], default: [] },
    education: { type: [EducationSchema], default: [] },
    projects: { type: [ProjectSchema], default: [] },
  },
  { timestamps: true }
);

export default models.User || model("User", UserSchema);