import { useEffect, useState } from "react";
import { useWallet } from "../context/WalletContext";
import JobCard from "../components/JobCard";
import { api } from "../services/api";

export default function ProfilePage() {
  const { address } = useWallet();
  const [profile, setProfile] = useState(null);
  const [clientJobs, setClientJobs] = useState([]);
  const [freelancerJobs, setFreelancerJobs] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const loadProfileData = async () => {
      setStatus("");
      setProfile(null);
      setClientJobs([]);
      setFreelancerJobs([]);

      if (!address) {
        setStatus("Connect wallet to view your profile.");
        return;
      }

      try {
        const [profileResult, clientJobsResult, freelancerJobsResult] =
          await Promise.all([
            api.getProfile(address),
            api.getJobs({ client_wallet: address, limit: 20 }),
            api.getJobs({
              freelancer_wallet: address,
              scope: "assigned",
              limit: 20
            })
          ]);

        setProfile(profileResult.profile);
        setClientJobs(clientJobsResult.jobs || []);
        setFreelancerJobs(freelancerJobsResult.jobs || []);
      } catch (error) {
        setStatus(error.message);
      }
    };

    loadProfileData();
  }, [address]);

  const skills = profile?.skills || [];

  return (
    <section>
      <h2>Profile</h2>
      <div className="card">
        <p>
          <strong>Wallet Identity:</strong> {address || "Connect wallet"}
        </p>
        {profile ? (
          <>
            <p>
              <strong>Role:</strong> {profile.role}
            </p>
            <p>
              <strong>Bio:</strong> {profile.bio || "No bio added yet."}
            </p>
            <p>
              <strong>Portfolio:</strong>{" "}
              {profile.portfolio ? (
                <a href={profile.portfolio} target="_blank" rel="noreferrer">
                  {profile.portfolio}
                </a>
              ) : (
                "No portfolio added yet."
              )}
            </p>
            <div className="pill-row">
              {skills.length > 0 ? (
                skills.map((skill) => (
                  <span className="status-pill" key={skill}>
                    {skill}
                  </span>
                ))
              ) : (
                <span className="status-pill">No skills listed</span>
              )}
            </div>
          </>
        ) : (
          <p>Register on the Role page to complete your profile.</p>
        )}
      </div>

      <div className="dashboard-section">
        <div className="section-heading">
          <h3>Jobs Assigned to Me</h3>
          <span>{freelancerJobs.length} jobs</span>
        </div>
        {freelancerJobs.length > 0 ? (
          <div className="grid-cards">
            {freelancerJobs.map((job) => (
              <JobCard key={job.job_id} job={job} variant="assigned" />
            ))}
          </div>
        ) : (
          <p className="empty-state">No assigned freelancer jobs yet.</p>
        )}
      </div>

      <div className="dashboard-section">
        <div className="section-heading">
          <h3>Jobs I Created</h3>
          <span>{clientJobs.length} jobs</span>
        </div>
        {clientJobs.length > 0 ? (
          <div className="grid-cards">
            {clientJobs.map((job) => (
              <JobCard key={job.job_id} job={job} />
            ))}
          </div>
        ) : (
          <p className="empty-state">No client jobs created from this wallet yet.</p>
        )}
      </div>

      {status && <p className="status">{status}</p>}
    </section>
  );
}
