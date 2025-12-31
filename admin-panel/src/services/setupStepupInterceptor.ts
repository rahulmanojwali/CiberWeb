import axios, { AxiosHeaders } from "axios";
import { getBrowserSessionId } from "../security/stepup/browserSession";

axios.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const stepupSessionId = localStorage.getItem("cm_stepup_session_id");
      const currentHeaders = AxiosHeaders.from(config.headers || {});
      if (stepupSessionId) {
        currentHeaders.set("X-StepUp-Session", stepupSessionId);
      }
      const browserSessionId = getBrowserSessionId();
      if (browserSessionId) {
        currentHeaders.set("X-StepUp-Browser-Session", browserSessionId);
      }
      config.headers = currentHeaders;
    }
    return config;
  },
  (error) => Promise.reject(error),
);
