// src/config.js
export const API_URL =
  process.env.REACT_APP_API_URL || "http://localhost:4000";
export const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || API_URL;
