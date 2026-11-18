import { useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { useData } from "./state.jsx";
import { request, dateTime, mediaUrl } from "./api.js";
export function PublicAdvertisements({ professional }) {
  const location = useLocation();
  const state = useData(
    "/public/advertisements" +
      (professional ? "?professional=" + professional : ""),
  );
  if (state.loading) return <p>Loading advertisements…</p>;
  if (state.error)
    return <p role="alert">Advertisements are temporarily unavailable.</p>;
  if (!state.data?.items.length) return <p>No active advertisements.</p>;
  return (
    <div className="ad-grid">
      {state.data.items.map((ad) => (
        <article className="panel" key={ad._id}>
          {ad.videoUrl ? (
            <video className="ad-image" src={mediaUrl(ad.videoUrl)} controls preload="metadata" aria-label={`${ad.title} advertisement video`} />
          ) : ad.imageUrl && (
            <img
              className="ad-image"
              src={mediaUrl(ad.imageUrl)}
              alt={ad.title}
              loading="lazy"
            />
          )}
          <h3>{ad.title}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{ad.body}</p>
          <p>Available until {dateTime(ad.endsAt)}</p>
          <Link to={"/professionals/" + ad.professional} state={{ returnTo: location.pathname === "/" ? "/#featured" : location.pathname + location.search, returnLabel: location.pathname === "/" ? "← Back to advertisements" : "← Back to previous page" }}>
            Professional profile
          </Link>
        </article>
      ))}
    </div>
  );
}
export function ProfessionalPublicProfile() {
  const { id } = useParams();
  const location = useLocation();
  const backTo = location.state?.returnTo || "/#professionals";
  const backLabel = location.state?.returnLabel || "← Back to professionals";
  const state = useData("/public/professionals/" + id);
  const services = useData("/public/services?limit=100&professional=" + id);
  const profile = state.data;
  return (
    <section className="container section">
      <Link className="detail-back" to={backTo}>{backLabel}</Link>
      {state.loading && <p>Loading professional profile…</p>}
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {profile && <>
        <div className="discovery-detail">
          <div className="detail-image">{profile.photoUrl ? <img src={mediaUrl(profile.photoUrl)} alt={`${profile.salonName} profile`} /> : <span className="discovery-placeholder"><span className="profile-monogram" aria-hidden="true">{profile.salonName?.slice(0, 1)?.toUpperCase() || "S"}</span></span>}</div>
          <div className="detail-copy">
            <p className="discovery-kicker">BEAUTY PROFESSIONAL</p>
            <h1>{profile.salonName}</h1>
            {profile.address && <p className="discovery-subtitle">{profile.address}</p>}
            <p>{profile.description || "Explore available services and get in touch."}</p>
            {profile.phone && <div className="detail-fact"><small>PHONE</small><strong>{profile.phone}</strong></div>}
            {profile.whatsappNumber && <div className="detail-fact"><small>WHATSAPP</small><strong>{profile.whatsappNumber}</strong></div>}
            {profile.email && <div className="detail-fact"><small>EMAIL</small><strong>{profile.email}</strong></div>}
            <div className="detail-actions">
              <Link className="button" to={`/book?professional=${encodeURIComponent(id)}`} state={{ returnTo: location.pathname, returnLabel: "← Back to professional profile" }}>Book an appointment ↗</Link>
              {profile.whatsappNumber && <a className="button secondary" href={`https://wa.me/${String(profile.whatsappNumber).replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Contact on WhatsApp ↗</a>}
            </div>
          </div>
        </div>
        <div className="section-heading"><h2>Available services</h2></div>
        {services.loading && <p>Loading services…</p>}
        {services.error && <p role="alert">Services are temporarily unavailable.</p>}
        {services.data?.items.length === 0 && <p>No published services yet.</p>}
        <div className="discovery-grid">
          {services.data?.items.map((item, i) => <Link className="discovery-card" key={item._id} to={`/services/${item._id}`} state={{ returnTo: location.pathname, returnLabel: "← Back to professional profile" }}>
            <div className="discovery-media">{item.imageUrl ? <img src={mediaUrl(item.imageUrl)} alt={item.name} loading="lazy"/> : <span className="discovery-placeholder">✂</span>}<span className="discovery-number">{String(i + 1).padStart(2, "0")}</span></div>
            <div className="discovery-body"><div className="discovery-kicker">SERVICE <span>↗</span></div><h3>{item.name}</h3><p className="discovery-description">{item.description}</p><div className="discovery-meta"><strong>{(item.priceLisente / 100).toLocaleString("en-LS", {style:"currency",currency:"LSL"})}</strong><span>{item.durationMinutes} min</span></div></div>
          </Link>)}
        </div>
        <div className="section-heading"><h2>Advertisements</h2></div>
        <PublicAdvertisements professional={id} />
      </>}
    </section>
  );
}
export function AdvertisementManagement() {
  const state = useData("/professional/advertisements");
  const [editing, setEditing] = useState(null),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function action(callback) {
    setBusy(true);
    setError("");
    try {
      await callback();
      state.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p>
        Publish immediately for seven days. Maximum three active advertisements.
        Images: PNG, JPEG or WebP, up to 5 MB. Videos: MP4 or WebM, up to 50 MB.
      </p>
      {error && <p role="alert">{error}</p>}
      {state.error && <p role="alert">{state.error}</p>}
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          action(async () => {
            await request(
              "/professional/advertisements" + (editing ? "/" + editing : ""),
              { method: editing ? "PATCH" : "POST", body: { title, body } },
            );
            setEditing(null);
            setTitle("");
            setBody("");
          });
        }}
      >
        <h2>{editing ? "Edit advertisement" : "Create advertisement"}</h2>
        <label>
          Advertisement title
          <input
            required
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Advertisement description
          <textarea
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <button disabled={busy} type="submit">
          {editing ? "Save advertisement" : "Create advertisement"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setTitle("");
              setBody("");
            }}
          >
            Cancel edit
          </button>
        )}
      </form>
      {state.loading && <p>Loading advertisements…</p>}
      {!state.loading && !state.data?.items.length && (
        <p>No advertisements yet.</p>
      )}
      <div className="ad-grid">
        {state.data?.items.map((ad) => (
          <article className="panel" key={ad._id}>
            <h2>{ad.title}</h2>
            <p>{ad.body}</p>
            <p>Status: {ad.status}</p>
            {ad.endsAt && <p>Expires: {dateTime(ad.endsAt)}</p>}
            {ad.videoUrl ? (
              <>
                <p>Promotional video attached.</p>
                <video className="ad-image" src={mediaUrl(ad.videoUrl)} controls preload="metadata" aria-label={`${ad.title} video preview`} />
              </>
            ) : ad.imageUrl ? (
              <>
                <p>Promotional image attached.</p>
                <img className="ad-image" src={mediaUrl(ad.imageUrl)} alt={`${ad.title} preview`} />
              </>
            ) : <p>No promotional media attached.</p>}
            <label>
              Image for {ad.title}
              <input
                disabled={busy}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file)
                    action(() => {
                      if (file.size > 5 * 1024 * 1024)
                        throw new Error("Image must be at most 5 MB.");
                      return request(
                        "/professional/advertisements/" + ad._id + "/image",
                        {
                          method: "PUT",
                          rawBody: file,
                          headers: { "Content-Type": file.type },
                        },
                      );
                    });
                  e.target.value = "";
                }}
              />
            </label>
            <label>
              Video for {ad.title}
              <input
                disabled={busy}
                type="file"
                accept="video/mp4,video/webm"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file)
                    action(() => {
                      if (file.size > 50 * 1024 * 1024)
                        throw new Error("Video must be at most 50 MB.");
                      return request(
                        "/professional/advertisements/" + ad._id + "/video",
                        {
                          method: "PUT",
                          rawBody: file,
                          headers: { "Content-Type": file.type },
                        },
                      );
                    });
                  e.target.value = "";
                }}
              />
            </label>
            <div className="ad-actions">
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(ad._id);
                  setTitle(ad.title);
                  setBody(ad.body || "");
                }}
              >
                Edit
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  action(() =>
                    request(
                      "/professional/advertisements/" +
                        ad._id +
                        (ad.status === "published" ? "/unpublish" : "/publish"),
                      { method: "POST" },
                    ),
                  )
                }
              >
                {ad.status === "published" ? "Unpublish" : "Publish"}
              </button>
              {(ad.imageUrl || ad.videoUrl) && (
                <button
                  disabled={busy}
                  onClick={() =>
                    action(() =>
                      request(
                        "/professional/advertisements/" + ad._id + "/media",
                        { method: "DELETE" },
                      ),
                    )
                  }
                >
                  Remove media
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete this advertisement and its promotional media?",
                    )
                  )
                    action(() =>
                      request("/professional/advertisements/" + ad._id, {
                        method: "DELETE",
                      }),
                    );
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
