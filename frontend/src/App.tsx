import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { BottomNav } from './components/BottomNav';
import { LoginScreen } from './screens/LoginScreen';
import { SignupScreen } from './screens/SignupScreen';
import { JoinScreen } from './screens/JoinScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { LogScreen } from './screens/LogScreen';
import { ProfileScreen } from './screens/ProfileScreen';

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {children}
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/signup" element={<SignupScreen />} />
      <Route
        path="/join"
        element={
          <RequireAuth>
            <JoinScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell>
              <DashboardScreen />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/log"
        element={
          <RequireAuth>
            <AppShell>
              <LogScreen />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <AppShell>
              <ProfileScreen />
            </AppShell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
