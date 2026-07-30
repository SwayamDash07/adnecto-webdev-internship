import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import SearchForm from "@/components/search/SearchForm";
import UserCard from "@/components/search/UserCard";
import { getFriendStatusMap } from "@/lib/relationships";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    name?: string;
    location?: string;
    hobbies?: string;
    interests?: string;
    musicTaste?: string;
    movieTaste?: string;
    friendsOnly?: string;
  }>;
}) {
  const currentUser = await requireUser();
  const params = await searchParams;
  await connectDB();
  const friendsOnly = params.friendsOnly === "1";

  const friendIds = friendsOnly
    ? (currentUser.friends || []).map((id: any) => String(id))
    : [];
  const filters: Record<string, unknown>[] = friendsOnly
    ? [{ _id: { $in: friendIds } }]
    : [{ _id: { $ne: currentUser._id } }];

  if (friendsOnly) {
    if (params.q) {
      const pattern = new RegExp(params.q, "i");
      filters.push({
        $or: [{ name: pattern }, { username: pattern }],
      });
    }
  } else {
    if (params.q) {
      const pattern = new RegExp(params.q, "i");
      filters.push({
        $or: [
          { name: pattern },
          { username: pattern },
          { location: pattern },
          { hobbies: pattern },
          { interests: pattern },
          { musicTaste: pattern },
          { movieTaste: pattern },
        ],
      });
    }

    if (params.name) {
      filters.push({
        $or: [
          { name: { $regex: params.name, $options: "i" } },
          { username: { $regex: params.name, $options: "i" } },
        ],
      });
    }

    if (params.location) {
      filters.push({ location: { $regex: params.location, $options: "i" } });
    }

    if (params.hobbies) {
      const hobbyTerms = params.hobbies.split(",").map((term) => term.trim()).filter(Boolean);
      if (hobbyTerms.length > 0) {
        filters.push({
          hobbies: { $in: hobbyTerms.map((term) => new RegExp(term, "i")) },
        });
      }
    }

    if (params.interests) {
      const interestTerms = params.interests.split(",").map((term) => term.trim()).filter(Boolean);
      if (interestTerms.length > 0) {
        filters.push({
          interests: { $in: interestTerms.map((term) => new RegExp(term, "i")) },
        });
      }
    }

    if (params.musicTaste) {
      filters.push({ musicTaste: { $regex: params.musicTaste, $options: "i" } });
    }

    if (params.movieTaste) {
      filters.push({ movieTaste: { $regex: params.movieTaste, $options: "i" } });
    }

  }

  const hasActiveFilter = Boolean(
    params.q ||
      params.name ||
      params.location ||
      params.hobbies ||
      params.interests ||
      params.musicTaste ||
      params.movieTaste ||
      friendsOnly
  );

  const results: any[] = hasActiveFilter
    ? await User.find({ $and: filters })
        .select(
          friendsOnly
            ? "username name"
            : "username name location hobbies interests musicTaste movieTaste"
        )
        .limit(30)
        .lean()
    : [];

  const friendStatusMap = friendsOnly ? new Map() : await getFriendStatusMap(
    String(currentUser._id),
    results.map((u: any) => String(u._id))
  );

  return (
    <div className="container">
      <Link href={friendsOnly ? `/profile/${currentUser.username}` : "/home"} className="page-back-link">
        {friendsOnly ? "Back to profile" : "Back to home"}
      </Link>
      {friendsOnly ? (
        <form action="/search" method="GET" className="search-form">
          <input type="hidden" name="friendsOnly" value="1" />
          <input
            type="text"
            name="q"
            placeholder="Search your friends by name or username"
            defaultValue={params.q}
            className="text-input"
          />
          <button type="submit" className="submit-button" style={{ width: 160 }}>
            Search friends
          </button>
        </form>
      ) : (
        <SearchForm defaultValues={params} />
      )}
      {friendsOnly && (
        <div className="user-card-meta" style={{ marginBottom: 16 }}>
          Only your friends will appear here.
        </div>
      )}
      {!hasActiveFilter && (
        <div className="empty-state" style={{ padding: 40 }}>
          Search by name, location, hobbies, interests, music, or shows to find people.
        </div>
      )}
      {hasActiveFilter && results.length === 0 && (
        <div className="empty-state" style={{ padding: 40 }}>No one matched those filters.</div>
      )}
      {results.length > 0 && (
        <div className={friendsOnly ? "friend-search-list" : "result-grid"}>
          {results.map((user: any) => (
            friendsOnly ? (
              <Link key={user.username} href={`/profile/${user.username}`} className="friend-row friend-search-row">
                <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div className="user-card-name">{user.name}</div>
                  <div className="user-card-meta">@{user.username}</div>
                </div>
              </Link>
            ) : (
              <UserCard
                key={user.username}
                user={JSON.parse(JSON.stringify(user))}
                friendStatus={friendStatusMap.get(String(user._id))}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}
