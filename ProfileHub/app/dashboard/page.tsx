import { requireUser } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/User";
import NavMenu from "@/components/dashboard/NavMenu";
import EditableSidebar from "@/components/dashboard/EditableSidebar";
import EditableBio from "@/components/dashboard/EditableBio";
import EditableSkills from "@/components/dashboard/EditableSkills";
import ExperienceSection from "@/components/dashboard/ExperienceSection";
import EducationSection from "@/components/dashboard/EducationSection";
import ProjectsSection from "@/components/dashboard/ProjectsSection";
import LogoutButton from "@/components/dashboard/LogoutButton";
import {
  updateBioAction,
  updateSkillsAction,
  addExperienceAction,
  deleteExperienceAction,
  addEducationAction,
  deleteEducationAction,
  addProjectAction,
  deleteProjectAction,
} from "./profile-actions";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; edit?: string }>;
}) {
  const sessionUser = await requireUser();
  const params = await searchParams;
  const canEdit = params.mode === "edit";
  const editing = params.edit;

  await connectDB();
  const user: any = await User.findById(sessionUser._id).lean();

  const experience = (user.experience ?? []).map((e: any) => ({
    _id: e._id.toString(),
    title: e.title,
    company: e.company,
    duration: e.duration,
    description: e.description,
  }));

  const education = (user.education ?? []).map((e: any) => ({
    _id: e._id.toString(),
    degree: e.degree,
    institution: e.institution,
    duration: e.duration,
    description: e.description,
  }));

  const projects = (user.projects ?? []).map((p: any) => ({
    _id: p._id.toString(),
    title: p.title,
    description: p.description,
    link: p.link,
  }));

  return (
    <main className="dashboard-page">
      <div className="dashboard-top-bar">
        <NavMenu
          variant="menu"
          links={[
            { label: "Home", href: "/" },
            { label: "Settings", href: "/dashboard/settings" },
            {
              label: canEdit ? "Done editing" : "Edit profile",
              href: canEdit ? "/dashboard" : "/dashboard?mode=edit",
            },
          ]}
        />
        <LogoutButton />
      </div>
      <div className="profile-grid">
        <EditableSidebar
          data={{
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber,
            state: user.state,
            country: user.country,
            dobDisplay: new Date(user.dob).toLocaleDateString(),
            profilePicture: user.profilePicture ?? "",
            joinedDate: new Date(user.createdAt).toLocaleDateString(),
          }}
        />
        <div className="profile-main-column">
          <EditableBio
            isEditing={editing === "bio"}
            canEdit={canEdit}
            bio={user.bio ?? ""}
            action={updateBioAction}
          />
          <ExperienceSection
            isAdding={editing === "experience"}
            canEdit={canEdit}
            experience={experience}
            addAction={addExperienceAction}
            deleteAction={deleteExperienceAction}
          />
          <EducationSection
            isAdding={editing === "education"}
            canEdit={canEdit}
            education={education}
            addAction={addEducationAction}
            deleteAction={deleteEducationAction}
          />
          <ProjectsSection
            isAdding={editing === "project"}
            canEdit={canEdit}
            projects={projects}
            addAction={addProjectAction}
            deleteAction={deleteProjectAction}
          />
          <EditableSkills
            isEditing={editing === "skills"}
            canEdit={canEdit}
            skills={user.skills ?? []}
            action={updateSkillsAction}
          />
        </div>
      </div>
    </main>
  );
}