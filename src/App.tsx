// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './components/login-page'
import Dashboard from './components/ui/dashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App