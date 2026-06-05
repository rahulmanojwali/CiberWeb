import axios from "axios";
import { apiLoadingTracker } from "../context/ApiLoadingContext";

declare global {
  interface Window {
    __cmApiLoadingInterceptorsInstalled?: boolean;
    __cmOriginalFetch?: typeof fetch;
  }
}

function isBrowser() {
  return typeof window !== "undefined";
}

function installAxiosProgressTracker() {
  axios.interceptors.request.use(
    (config) => {
      apiLoadingTracker.start();
      (config as any).__cmApiProgressTracked = true;
      return config;
    },
    (error) => {
      apiLoadingTracker.finish();
      return Promise.reject(error);
    },
  );

  axios.interceptors.response.use(
    (response) => {
      if ((response.config as any)?.__cmApiProgressTracked) {
        apiLoadingTracker.finish();
      }
      return response;
    },
    (error) => {
      if ((error?.config as any)?.__cmApiProgressTracked) {
        apiLoadingTracker.finish();
      }
      return Promise.reject(error);
    },
  );
}

function installFetchProgressTracker() {
  if (!isBrowser() || typeof window.fetch !== "function") return;
  if (window.__cmOriginalFetch) return;

  window.__cmOriginalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    apiLoadingTracker.start();
    try {
      return await window.__cmOriginalFetch!(...args);
    } finally {
      apiLoadingTracker.finish();
    }
  };
}

export function installApiLoadingInterceptors() {
  if (isBrowser() && window.__cmApiLoadingInterceptorsInstalled) return;
  installAxiosProgressTracker();
  installFetchProgressTracker();
  if (isBrowser()) {
    window.__cmApiLoadingInterceptorsInstalled = true;
  }
}

installApiLoadingInterceptors();

export default axios;
