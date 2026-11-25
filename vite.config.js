import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const __dirname = import.meta.dirname

// Every generated services/**/index.html becomes its own page in the build
function servicePageInputs() {
  const inputs = {}
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === 'index.html') {
        const name = path.relative(__dirname, path.dirname(full)).replace(/\\/g, '/')
        inputs[name] = full
      }
    }
  }
  walk(path.resolve(__dirname, 'services'))
  return inputs
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        ...servicePageInputs(),
      },
    },
  },
})
