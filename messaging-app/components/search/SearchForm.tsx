export default function SearchForm({
  defaultValues,
}: {
  defaultValues: {
    name?: string;
    location?: string;
    hobbies?: string;
    interests?: string;
    musicTaste?: string;
    movieTaste?: string;
  };
}) {
  return (
    <form action="/search" method="GET" className="search-form">
      <div className="search-row">
        <input
          type="text"
          name="name"
          placeholder="Name or username"
          defaultValue={defaultValues.name}
          className="text-input"
        />
        <input
          type="text"
          name="location"
          placeholder="Location"
          defaultValue={defaultValues.location}
          className="text-input"
        />
      </div>
      <div className="search-row">
        <input
          type="text"
          name="hobbies"
          placeholder="Hobbies, comma separated"
          defaultValue={defaultValues.hobbies}
          className="text-input"
        />
        <input
          type="text"
          name="interests"
          placeholder="Interests, comma separated"
          defaultValue={defaultValues.interests}
          className="text-input"
        />
      </div>
      <div className="search-row">
        <input
          type="text"
          name="musicTaste"
          placeholder="Music taste"
          defaultValue={defaultValues.musicTaste}
          className="text-input"
        />
        <input
          type="text"
          name="movieTaste"
          placeholder="Movies / shows"
          defaultValue={defaultValues.movieTaste}
          className="text-input"
        />
      </div>
      <button type="submit" className="submit-button" style={{ width: 140 }}>
        Search
      </button>
    </form>
  );
}
