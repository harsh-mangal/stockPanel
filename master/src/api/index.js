// src/api/index.js
import axios from "axios";
import { BASE_URL } from "../config";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false, // flip to true if you use cookies/sessions
});

// Unwrap data + normalize errors
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

export const AccountsAPI = {
  listAll: () => api.get("/accounts"),
  listOnline: () => api.get("/accounts/online"), // change to /accounts/presence/debug if that's your route
  create: (body) => api.post("/accounts", body),
  update: (id, body) => api.patch(`/accounts/${id}`, body),
  bulkCreate: (body) => api.post("/accounts/bulk", body),
};

export const OrdersAPI = {
  createMaster: (payload) => api.post("/orders/master", payload),
  listMasters: () => api.get("/orders/master"),
  getMaster: (id) => api.get(`/orders/master/${id}`),
};
