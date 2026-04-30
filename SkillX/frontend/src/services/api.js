const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
  } catch (_error) {
    throw new Error(
      "Cannot reach backend API. Check backend server and CORS configuration."
    );
  }

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : { error: await res.text() };

  if (!res.ok) {
    const message = data.details
      ? `${data.error} - ${data.details}`
      : data.error || "API request failed";
    throw new Error(message);
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
  getProfile(walletAddress) {
    return request(`/profile/${encodeURIComponent(walletAddress)}`);
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
  getJobs(params = {}) {
    const search = new URLSearchParams();
    if (params.freelancer_wallet) {
      search.set("freelancer_wallet", params.freelancer_wallet);
    }
    if (params.client_wallet) {
      search.set("client_wallet", params.client_wallet);
    }
    if (params.limit) {
      search.set("limit", String(params.limit));
    }
    if (params.scope) {
      search.set("scope", params.scope);
    }
    const q = search.toString();
    return request(`/jobs${q ? `?${q}` : ""}`);
  },
  getJob(jobId) {
    return request(`/job/${jobId}`);
  },
  acceptJob(jobId, freelancer_wallet) {
    return request(`/job/${jobId}/accept`, {
      method: "POST",
      body: JSON.stringify({ freelancer_wallet })
    });
  },
  rejectJob(jobId, freelancer_wallet) {
    return request(`/job/${jobId}/reject`, {
      method: "POST",
      body: JSON.stringify({ freelancer_wallet })
    });
  },
  submitMilestone(payload) {
    return request("/submit", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
