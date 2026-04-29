const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "API request failed");
  }
  return data;
}

export const api = {
  createProfile(payload) {
    return request("/profile", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getFreelancers(category) {
    const q = category ? `?category=${encodeURIComponent(category)}` : "";
    return request(`/freelancers${q}`);
  },
  createJob(payload) {
    return request("/job", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getJob(jobId) {
    return request(`/job/${jobId}`);
  },
  submitMilestone(payload) {
    return request("/submit", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
