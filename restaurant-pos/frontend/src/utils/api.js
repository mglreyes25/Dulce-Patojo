const API_URL = import.meta.env.VITE_API_URL || '';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL || undefined;

export { API_URL, SOCKET_URL };
export default API_URL;
