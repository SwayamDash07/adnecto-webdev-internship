type SidebarData = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber: string;
  state: string;
  country: string;
  dobDisplay: string;
  profilePicture: string;
  joinedDate: string;
};

export default function EditableSidebar({ data }: { data: SidebarData }) {
  const initials = `${data.firstName[0] ?? ""}${data.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="sidebar-card">
      <div className="sidebar-avatar-large">
        {data.profilePicture ? (
          <img src={data.profilePicture} alt={`${data.firstName} ${data.lastName}`} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <h1 className="profile-name">{data.firstName} {data.lastName}</h1>
      <p className="profile-username">@{data.username}</p>
      <div className="sidebar-details">
        <div className="sidebar-detail-row"><span>Email</span><span>{data.email}</span></div>
        <div className="sidebar-detail-row"><span>Phone</span><span>{data.phoneNumber}</span></div>
        <div className="sidebar-detail-row"><span>Location</span><span>{data.state}, {data.country}</span></div>
        <div className="sidebar-detail-row"><span>Date of birth</span><span>{data.dobDisplay}</span></div>
        <div className="sidebar-detail-row"><span>Joined</span><span>{data.joinedDate}</span></div>
      </div>
    </div>
  );
}