import axios from "axios";

axios.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const stepupSessionId = localStorage.getItem("cm_stepup_session_id");
      if (stepupSessionId) {
        config.headers = {
          ...(config.headers || {}),
          "X-StepUp-Session": stepupSessionId,
        };
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);
