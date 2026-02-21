import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { loginThunk, registerThunk, fetchAvailableTeams } from '../store/authSlice';
import { Spinner } from '../components/common';
import type { Team } from '../api/tauri';

type Mode = 'login' | 'register' | 'pick-team';

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, loading, error, availableTeams } = useAppSelector((s) => s.auth);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (mode === 'pick-team' && availableTeams.length === 0) {
      dispatch(fetchAvailableTeams());
    }
  }, [mode, dispatch, availableTeams.length]);

  const handleLogin = () => {
    if (email && password) dispatch(loginThunk({ email, password }));
  };

  const handleRegister = () => {
    if (selectedTeam && name && email && password) {
      dispatch(registerThunk({ name, email, password, managedTeamId: selectedTeam.id }));
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-navy-950 via-navy-900 to-pitch-dark pt-safe-top">
      {/* Header */}
      <div className="flex flex-col items-center pt-10 pb-6 px-6 flex-shrink-0">
        <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center mb-4 shadow-lg shadow-brand-600/30">
          <span className="text-3xl">&#9917;</span>
        </div>
        <h1 className="text-xl font-extrabold text-white">Football Fantasy</h1>
        <p className="text-xs text-navy-400 mt-1">Manager Mobile</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 flex flex-col justify-center">
        {mode === 'login' && (
          <div className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder-navy-500 focus:border-brand-500 focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder-navy-500 focus:border-brand-500 focus:outline-none"
            />
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <button onClick={handleLogin} disabled={loading} className="mobile-btn-primary h-12 mt-1">
              {loading ? <Spinner size="sm" /> : 'Sign In'}
            </button>
            <button onClick={() => setMode('register')} className="mobile-btn-ghost text-sm">
              Create Account
            </button>
          </div>
        )}

        {mode === 'register' && (
          <div className="flex flex-col gap-3">
            <input
              placeholder="Manager Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder-navy-500 focus:border-brand-500 focus:outline-none"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder-navy-500 focus:border-brand-500 focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder-navy-500 focus:border-brand-500 focus:outline-none"
            />
            <button onClick={() => setMode('pick-team')} className="mobile-btn-primary h-12 mt-1">
              Choose Your Team
            </button>
            <button onClick={() => setMode('login')} className="mobile-btn-ghost text-sm">
              Back to Login
            </button>
          </div>
        )}

        {mode === 'pick-team' && (
          <div className="flex flex-col gap-3 h-full">
            <h2 className="text-base font-bold text-white text-center">Select Your Club</h2>
            <div className="flex-1 grid grid-cols-2 gap-2 overflow-hidden content-start" style={{ maxHeight: '55vh' }}>
              {availableTeams.slice(0, 12).map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                    selectedTeam?.id === team.id
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0"
                    style={{ backgroundColor: team.primary_color || '#666' }}
                  />
                  <span className="text-xs font-semibold text-white truncate">{team.short_name || team.name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={handleRegister}
              disabled={!selectedTeam || loading}
              className="mobile-btn-primary h-12 flex-shrink-0"
            >
              {loading ? <Spinner size="sm" /> : 'Start Managing'}
            </button>
            <button onClick={() => setMode('register')} className="mobile-btn-ghost text-sm flex-shrink-0">
              Back
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 pb-8 text-center">
        <p className="text-[10px] text-navy-600">Powered by Tauri + Rust</p>
      </div>
    </div>
  );
}
