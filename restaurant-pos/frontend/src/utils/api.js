import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL || undefined;

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if ((status === 401 || status === 403) && localStorage.getItem('token')) {
      localStorage.clear();
      window.location.replace('/sesion-expirada');
    }
    return Promise.reject(error);
  }
);

export { API_URL, SOCKET_URL };
export default API_URL;
