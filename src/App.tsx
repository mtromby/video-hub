import { Route, Routes } from 'react-router-dom'

import { LoginPage } from '@/pages/LoginPage'
import { MainApp } from '@/pages/MainApp'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<MainApp />} />
    </Routes>
  )
}
