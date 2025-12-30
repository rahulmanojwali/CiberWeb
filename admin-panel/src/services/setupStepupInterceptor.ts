import axios, { type AxiosRequestHeaders } from "axios";

axios.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const stepupSessionId = localStorage.getItem("cm_stepup_session_id");
      if (stepupSessionId) {
        const currentHeaders = (config.headers || {}) as AxiosRequestHeaders;
        config.headers = {
          ...currentHeaders,
          "X-StepUp-Session": stepupSessionId,
        };
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);
