// src/api/index.js
import axios from "axios";
import { API_URL } from "../config";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      "Request failed";
    return Promise.reject(new Error(msg));
  }
);

// Add endpoints if you later expose linked-specific REST APIs
export const LinkedAPI = {
  // login: (body) => api.post("/linked/login", body),
  // listMyChildren: (accountId) => api.get(`/orders/children?accountId=${accountId}`),
};
