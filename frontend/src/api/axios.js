import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8001/api/",
});

// Attach access token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Refresh access token automatically when it expires
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refresh = localStorage.getItem("refresh");

        if (!refresh) {
          throw new Error("No refresh token found");
        }

        const res = await axios.post(
          "http://127.0.0.1:8001/api/users/refresh/",
          { refresh }
        );

        const newAccessToken = res.data.access;

        localStorage.setItem("access", newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        localStorage.removeItem("user");

        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  }
);

export default api;