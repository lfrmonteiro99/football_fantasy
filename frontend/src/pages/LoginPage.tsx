import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'hooks/useAuth';
import Button from 'components/common/Button';
import Spinner from 'components/common/Spinner';
import type { Team } from 'types';

type Tab = 'login' | 'register';
type RegisterStep = 'credentials' | 'team';

export default function LoginPage() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    loading,
    error,
    login,
    register,
    fetchAvailableTeams,
    availableTeams,
  } = useAuth();

  const [tab, setTab] = useState<Tab>('login');

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regStep, setRegStep] = useState<RegisterStep>('credentials');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  // Redirect on auth
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({ email: loginEmail, password: loginPassword });
  };

  // Handle register step 1 -> step 2
  const handleRegNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) return;
    await fetchAvailableTeams();
    setRegStep('team');
  };

  // Handle register submit
  const handleRegSubmit = async () => {
    if (!selectedTeamId) return;
    await register({
      name: regName,
      email: regEmail,
      password: regPassword,
      password_confirmation: regPassword,
      managed_team_id: selectedTeamId,
    });
  };

  const isLoading = loading === 'loading';

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      {/* LEFT: Navy hero panel (top banner on mobile, left column on sm+) */}
      <div className="relative flex flex-col items-center justify-center bg-navy-900 px-8 py-10 sm:w-1/2 sm:py-0">
        {/* Diagonal line texture overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(135deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.04) 75%, transparent 75%)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative z-10 text-center">
          <h1 className="font-display text-5xl font-extrabold uppercase tracking-wider text-white">
            Football FM
          </h1>
          <p className="mt-2 font-display text-xl uppercase tracking-wide text-accent-400">
            Fantasy Manager
          </p>
        </div>
      </div>

      {/* RIGHT: Form panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-4 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <h2 className="font-display text-display-sm uppercase tracking-wide text-navy-900">
              {tab === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="mt-1 text-body text-navy-400">
              {tab === 'login'
                ? 'Sign in to manage your team'
                : 'Create an account and pick your team'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="mb-6 inline-flex w-full rounded-lg bg-navy-50 p-1">
            <button
              className={`flex-1 rounded-md px-4 py-2 text-body font-medium transition-all ${
                tab === 'login'
                  ? 'bg-navy-900 text-white'
                  : 'text-navy-400 hover:text-navy-600'
              }`}
              onClick={() => {
                setTab('login');
                setRegStep('credentials');
              }}
            >
              Login
            </button>
            <button
              className={`flex-1 rounded-md px-4 py-2 text-body font-medium transition-all ${
                tab === 'register'
                  ? 'bg-navy-900 text-white'
                  : 'text-navy-400 hover:text-navy-600'
              }`}
              onClick={() => setTab('register')}
            >
              Register
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-body-sm text-red-700">
              {error}
            </div>
          )}

          {/* Login tab */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-1.5 block text-caption font-medium uppercase tracking-wider text-navy-600"
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="input-base"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-caption font-medium uppercase tracking-wider text-navy-600"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="input-base"
                  placeholder="Enter your password"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full"
              >
                Sign In
              </Button>
            </form>
          )}

          {/* Register tab */}
          {tab === 'register' && regStep === 'credentials' && (
            <form onSubmit={handleRegNext} className="space-y-4">
              <div>
                <label
                  htmlFor="reg-name"
                  className="mb-1.5 block text-caption font-medium uppercase tracking-wider text-navy-600"
                >
                  Manager Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="input-base"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label
                  htmlFor="reg-email"
                  className="mb-1.5 block text-caption font-medium uppercase tracking-wider text-navy-600"
                >
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="input-base"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="reg-password"
                  className="mb-1.5 block text-caption font-medium uppercase tracking-wider text-navy-600"
                >
                  Password
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="input-base"
                  placeholder="Min 8 characters"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full"
              >
                Next: Choose Team
              </Button>
            </form>
          )}

          {/* Register tab -- Team selection */}
          {tab === 'register' && regStep === 'team' && (
            <div>
              <button
                onClick={() => setRegStep('credentials')}
                className="mb-4 text-sm text-brand-600 hover:text-brand-700"
              >
                &larr; Back to credentials
              </button>

              <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-navy-800">
                Choose your team
              </h3>

              {isLoading && (availableTeams as Team[]).length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="lg" className="text-brand-600" />
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {(availableTeams as Team[]).map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                        selectedTeamId === team.id
                          ? 'border-l-4 border-l-accent-400 border-t-surface-border border-r-surface-border border-b-surface-border bg-accent-50 shadow-sm'
                          : 'border-surface-border hover:border-navy-200 hover:bg-surface-secondary'
                      }`}
                    >
                      {/* Team color swatch */}
                      <div
                        className="h-8 w-8 flex-shrink-0 rounded-full border border-gray-200"
                        style={{
                          background: team.primary_color
                            ? `linear-gradient(135deg, ${team.primary_color} 50%, ${team.secondary_color || team.primary_color} 50%)`
                            : '#d1d5db',
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-navy-900">
                          {team.name}
                        </p>
                        <p className="truncate text-xs text-navy-400">
                          {team.league?.name ?? 'Unknown League'}
                        </p>
                      </div>
                      {selectedTeamId === team.id && (
                        <svg
                          className="h-5 w-5 flex-shrink-0 text-accent-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                isLoading={isLoading}
                disabled={!selectedTeamId}
                onClick={handleRegSubmit}
                className="mt-4 w-full"
              >
                Create Account
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
