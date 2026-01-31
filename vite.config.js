import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Check if this is a ClientHub build
  const isClientHubBuild = mode === 'clienthub' || process.env.VITE_BUILD_TYPE === 'clienthub';
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    define: {
      // Inject build type into the app
      'import.meta.env.VITE_BUILD_TYPE': JSON.stringify(isClientHubBuild ? 'clienthub' : 'admin'),
    },
  };
})
