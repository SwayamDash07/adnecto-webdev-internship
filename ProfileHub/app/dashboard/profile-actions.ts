"use server";

import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { getSession } from "@/lib/session";

export async function updateSidebarAction(formData: FormData) {
  const currentUser = await getSession();
  if (!currentUser) redirect("/login");

  const firstName = formData.get("firstName")?.toString().trim();
  const lastName = formData.get("lastName")?.toString().trim();
  const username = formData.get("username")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const dob = formData.get("dob")?.toString();
  const state = formData.get("state")?.toString().trim();
  const country = formData.get("country")?.toString();
  const phoneNumber = formData.get("phoneNumber")?.toString().trim();
  const profilePicture = formData.get("profilePicture")?.toString().trim();

  if (!firstName || !lastName || !username || !email || !dob || !state || !country || !phoneNumber) {
    redirect("/dashboard/settings?error=missing");
  }

  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phoneNumber)) {
    redirect("/dashboard/settings?error=phone");
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!emailRegex.test(email)) {
    redirect("/dashboard/settings?error=email");
  }

  const dobDate = new Date(dob);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(dobDate.getTime()) || dobDate > today) {
    redirect("/dashboard/settings?error=dob");
  }

  await connectDB();

  const existingUsername = await User.findOne({ username, _id: { $ne: currentUser._id } });
  if (existingUsername) {
    redirect("/dashboard/settings?error=username");
  }

  const existingEmail = await User.findOne({ email, _id: { $ne: currentUser._id } });
  if (existingEmail) {
    redirect("/dashboard/settings?error=exists");
  }

  await User.findByIdAndUpdate(currentUser._id, {
    firstName,
    lastName,
    username,
    email,
    dob: dobDate,
    state,
    country,
    phoneNumber,
    profilePicture,
  });

  redirect("/dashboard/settings?success=1");
}

export async function updateBioAction(formData: FormData) {
  const currentUser = await getSession();
  if (!currentUser) redirect("/login");

  const bio = formData.get("bio")?.toString().trim() ?? "";

  await connectDB();
  await User.findByIdAndUpdate(currentUser._id, { bio });

  redirect("/dashboard?success=1");
}

export async function updateSkillsAction(formData: FormData) {
  const currentUser = await getSession();
  if (!currentUser) redirect("/login");

  const skillsRaw = formData.get("skills")?.toString().trim() ?? "";
  const skills = skillsRaw ? skillsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

  await connectDB();
  await User.findByIdAndUpdate(currentUser._id, { skills });

  redirect("/dashboard?success=1");
}

export async function addExperienceAction(formData: FormData) {
  const currentUser = await getSession();
  if (!currentUser) redirect("/login");

  const title = formData.get("title")?.toString().trim();
  const company = formData.get("company")?.toString().trim();
  const duration = formData.get("duration")?.toString().trim();
  const description = formData.get("description")?.toString().trim() ?? "";

  console.log("EXPERIENCE SUBMIT:", { title, company, duration, description });

  if (!title || !company || !duration) {
    redirect("/dashboard?error=missing");
  }

  await connectDB();
  await User.findByIdAndUpdate(currentUser._id, {
    $push: { experience: { title, company, duration, description } },
  });

  redirect("/dashboard?success=1");
}

export async function deleteExperienceAction(formData: FormData) {
  const currentUser = await getSession();
  if (!currentUser) redirect("/login");

  const experienceId = formData.get("experienceId")?.toString();
  if (!experienceId) redirect("/dashboard");

  await connectDB();
  await User.findByIdAndUpdate(currentUser._id, {
    $pull: { experience: { _id: experienceId } },
  });

  redirect("/dashboard?success=1");
}
export async function addEducationAction(formData: FormData) {
  const currentUser = await getSession();
  if (!currentUser) redirect("/login");

  const degree = formData.get("degree")?.toString().trim();
  const institution = formData.get("institution")?.toString().trim();
  const duration = formData.get("duration")?.toString().trim();
  const description = formData.get("description")?.toString().trim() ?? "";

  if (!degree || !institution || !duration) {
    redirect("/dashboard?error=missing");
  }

  await connectDB();
  await User.findByIdAndUpdate(currentUser._id, {
    $push: { education: { degree, institution, duration, description } },
  });

  redirect("/dashboard?success=1");
}

export async function deleteEducationAction(formData: FormData) {
  const currentUser = await getSession();
  if (!currentUser) redirect("/login");

  const educationId = formData.get("educationId")?.toString();
  if (!educationId) redirect("/dashboard");

  await connectDB();
  await User.findByIdAndUpdate(currentUser._id, {
    $pull: { education: { _id: educationId } },
  });

  redirect("/dashboard?success=1");
}

export async function addProjectAction(formData: FormData) {
  const currentUser = await getSession();
  if (!currentUser) redirect("/login");

  const title = formData.get("title")?.toString().trim();
  const description = formData.get("description")?.toString().trim() ?? "";
  const link = formData.get("link")?.toString().trim() ?? "";

  if (!title) {
    redirect("/dashboard?error=missing");
  }

  await connectDB();
  await User.findByIdAndUpdate(currentUser._id, {
    $push: { projects: { title, description, link } },
  });

  redirect("/dashboard?success=1");
}

export async function deleteProjectAction(formData: FormData) {
  const currentUser = await getSession();
  if (!currentUser) redirect("/login");

  const projectId = formData.get("projectId")?.toString();
  if (!projectId) redirect("/dashboard");

  await connectDB();
  await User.findByIdAndUpdate(currentUser._id, {
    $pull: { projects: { _id: projectId } },
  });

  redirect("/dashboard?success=1");
}