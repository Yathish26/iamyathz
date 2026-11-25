import { BrowserRouter, Routes, Route } from 'react-router'
import Home from './pages/Home.jsx'
import Traffic from './pages/Traffic.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/traffic" element={<Traffic />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
