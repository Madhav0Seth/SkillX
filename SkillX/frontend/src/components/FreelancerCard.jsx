export default function FreelancerCard({ freelancer }) {
  return (
    <article className="card">
      <h3>{freelancer.wallet_address}</h3>
      <p>{freelancer.bio || "No bio yet"}</p>
      <small>Skills: {(freelancer.skills || []).join(", ") || "N/A"}</small>
      <small>Portfolio: {freelancer.portfolio || "N/A"}</small>
    </article>
  );
}
