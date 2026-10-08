import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './app.css'
import Editor from './pages/editor/Editor'
import Gallery from './pages/Gallery'
import Home from './pages/Home'
import Print from './pages/Print'
import { Toasts, useAppTheme } from './ui'

export default function App() {
  useAppTheme()
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/deck/:id" element={<Editor />} />
        <Route path="/print/:id" element={<Print />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <Toasts />
    </BrowserRouter>
  )
}
