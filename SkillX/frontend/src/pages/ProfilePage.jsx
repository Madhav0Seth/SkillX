import { useState } from "react";
import { useWallet } from "../context/WalletContext";

export default function ProfilePage() {
  const { address } = useWallet();
  const [portfolio] = useState([
    "Soroban Escrow Contract Integration",
    "Stellar Payments Dashboard"
  ]);
  const [previousJobs] = useState([
    { id: 1, title: "Build Wallet Login", status: "completed" },
    { id: 2, title: "Milestone UI Design", status: "completed" }
  ]);

  return (
    <section>
      <h2>Profile</h2>
      <div className="card">
        <p>
          <strong>Wallet Identity:</strong> {address || "Connect wallet"}
        </p>
      </div>

      <div className="grid-cards">
        <article className="card">
          <h3>Portfolio</h3>
          {portfolio.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </article>
        <article className="card">
          <h3>Previous Jobs</h3>
          {previousJobs.map((job) => (
            <p key={job.id}>
              {job.title} - {job.status}
            </p>
          ))}
        </article>
      </div>
    </section>
  );
}
