import { SearchIcon } from "@/components/ui/icons";

export default function HomeSearchBar() {
  return (
    <form action="/search" method="GET" className="home-search-bar">
      <span className="home-search-icon">
        <SearchIcon size={22} />
      </span>
      <input
        type="text"
        name="q"
        placeholder="Search by name, username, hobby, interest, music, or show"
        className="home-search-input"
        autoComplete="off"
      />
    </form>
  );
}
