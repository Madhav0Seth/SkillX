import { API_BASE_URL } from "../config";

/**
 * Map raw error text to a friendly message the user can actually understand.
 */
function friendlyError(rawMessage, statusCode) {
  // HTML dumps from Cloudflare / reverse proxies
  if (rawMessage && (rawMessage.includes("<!DOCTYPE") || rawMessage.includes("<html"))) {
    if (statusCode === 521 || statusCode === 522 || statusCode === 523) {
      return "Database service is temporarily unavailable. It may be paused — please try again in a few minutes.";
    }
    return "The server returned an unexpected response. Please try again later.";
  }

  // Backend is completely unreachable
  if (!rawMessage || rawMessage === "Failed to fetch") {
    return "Cannot reach the backend server. Make sure it is running on " + API_BASE_URL;
  }

  return rawMessage;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
      signal: options.signal || controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The API request timed out. Please try again.");
    throw new Error(
      "Cannot reach the backend API. Please try again later."
    );
  } finally {
    window.clearTimeout(timeout);
  }

  const contentType = res.headers.get("content-type") || "";

  // Guard: if the response is HTML (Cloudflare error, proxy error, etc.)
  // never try to parse it as JSON — just surface a clean message
  if (contentType.includes("text/html")) {
    throw new Error(friendlyError(await res.text(), res.status));
  }

  const data = contentType.includes("application/json")
    ? await res.json().catch(() => ({ error: "The server returned invalid JSON." }))
    : { error: await res.text() };

  if (!res.ok) {
    const message = data.details
      ? `${data.error} — ${data.details}`
      : data.error || "API request failed";
    throw new Error(friendlyError(message, res.status));
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
    if (params.skill) {
      search.set("skill", params.skill);
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
  },
  recoverSubmittedMilestone(payload) {
    return request("/submit/recover", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  approveMilestone(milestoneId, client_wallet) {
    return request(`/milestone/${milestoneId}/approve`, {
      method: "POST",
      body: JSON.stringify({ client_wallet })
    });
  },
  getProfileStats(walletAddress) {
    return request(`/profile/${encodeURIComponent(walletAddress)}/stats`);
  }
};
