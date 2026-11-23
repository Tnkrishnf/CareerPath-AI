import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/Layout.jsx'
import { useAuth } from './context.jsx'
import Landing from './pages/Landing.jsx'
import { ForgotPassword, Login, Register } from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Profile from './pages/Profile.jsx'
import Assessment from './pages/Assessment.jsx'
import Recommendations from './pages/Recommendations.jsx'
import Chatbot from './pages/Chatbot.jsx'
import SkillGap from './pages/SkillGap.jsx'
import Roadmap from './pages/Roadmap.jsx'
import Courses from './pages/Courses.jsx'
import ResumeAnalyzer from './pages/ResumeAnalyzer.jsx'
import { ChatHistory, SavedCareers } from './pages/Library.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import { AdminCareers, AdminCourses } from './pages/AdminManage.jsx'

function Guest({ children }) {
  const { user } = useAuth()
  return user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace /> : children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Guest><Login /></Guest>} />
      <Route path="/register" element={<Guest><Register /></Guest>} />
      <Route path="/forgot-password" element={<Guest><ForgotPassword /></Guest>} />

      <Route element={<ProtectedRoute role="student" />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/chatbot" element={<Chatbot />} />
        <Route path="/skill-gap" element={<SkillGap />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/roadmap/:careerId" element={<Roadmap />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/resume" element={<ResumeAnalyzer />} />
        <Route path="/saved" element={<SavedCareers />} />
        <Route path="/history" element={<ChatHistory />} />
      </Route>
      <Route element={<ProtectedRoute role="admin" />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/careers" element={<AdminCareers />} />
        <Route path="/admin/courses" element={<AdminCourses />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
