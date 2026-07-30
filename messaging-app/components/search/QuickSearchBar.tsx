export default function QuickSearchBar() {
  return (
    <form action="/search" method="GET" className="quick-search-form">
      <input
        type="text"
        name="q"
        placeholder="Search by name, username, hobby, interest, music, or show"
        className="text-input"
        autoComplete="off"
      />
      <button type="submit" className="submit-button" style={{ width: "auto", padding: "11px 20px" }}>
        Search
      </button>
    </form>
  );
}
