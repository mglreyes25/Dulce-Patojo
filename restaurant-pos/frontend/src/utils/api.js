import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL || undefined;

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.expired) {
      localStorage.clear();
      window.location.href = '/sesion-expirada';
    }
    return Promise.reject(error);
  }
);

export { API_URL, SOCKET_URL };
export default API_URL;
