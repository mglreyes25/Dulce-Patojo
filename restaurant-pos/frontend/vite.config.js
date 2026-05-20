import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:5000',
      '/usuarios': 'http://localhost:5000',
      '/productos': 'http://localhost:5000',
      '/promociones': 'http://localhost:5000',
      '/inventario': 'http://localhost:5000',
      '/pedidos': 'http://localhost:5000',
      '/mesas': 'http://localhost:5000',
      '/ingredientes': 'http://localhost:5000',
      '/recetas': 'http://localhost:5000',
      '/proveedores': 'http://localhost:5000',
    }
  }
})
