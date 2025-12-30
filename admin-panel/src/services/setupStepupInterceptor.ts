import axios, { AxiosHeaders } from "axios";

axios.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const stepupSessionId = localStorage.getItem("cm_stepup_session_id");
      if (stepupSessionId) {
        const currentHeaders = AxiosHeaders.from(config.headers || {});
        currentHeaders.set("X-StepUp-Session", stepupSessionId);
        config.headers = currentHeaders;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);
