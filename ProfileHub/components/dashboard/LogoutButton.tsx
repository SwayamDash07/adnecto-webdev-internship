import { logoutAction } from "@/app/dashboard/actions";

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="logout-button">
        Log out
      </button>
    </form>
  );
}