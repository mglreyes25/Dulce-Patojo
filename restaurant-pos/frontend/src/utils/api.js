const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_URL;

export { API_URL, SOCKET_URL };
export default API_URL;
