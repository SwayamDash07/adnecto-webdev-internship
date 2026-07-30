"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireUser } from "@/lib/auth-guard";

export async function updateProfileAction(formData: FormData) {
  const currentUser = await requireUser();

  const name = String(formData.get("name") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const personalNote = String(formData.get("personalNote") || "").trim();
  const hobbiesRaw = String(formData.get("hobbies") || "");
  const interestsRaw = String(formData.get("interests") || "");
  const musicTaste = String(formData.get("musicTaste") || "").trim();
  const movieTaste = String(formData.get("movieTaste") || "").trim();
  const favoriteFood = String(formData.get("favoriteFood") || "").trim();
  const avatarUrl = String(formData.get("avatarUrl") || "").trim();

  if (!name || name.length > 60) {
    redirect(`/profile/${currentUser.username}?error=invalid_name`);
  }

  if (!location || location.length > 100) {
    redirect(`/profile/${currentUser.username}?edit=true&error=invalid_location`);
  }

  const hobbies = hobbiesRaw
    .split(",")
    .map((hobby) => hobby.trim())
    .filter(Boolean)
    .slice(0, 15);
  const interests = interestsRaw
    .split(",")
    .map((interest) => interest.trim())
    .filter(Boolean)
    .slice(0, 15);

  await connectDB();
  await User.findByIdAndUpdate(currentUser._id, {
    name,
    location,
    bio,
    personalNote,
    hobbies,
    interests,
    musicTaste,
    movieTaste,
    favoriteFood,
    avatarUrl,
  });

  revalidatePath(`/profile/${currentUser.username}`);
  redirect(`/profile/${currentUser.username}`);
}
