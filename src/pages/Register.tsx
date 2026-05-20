import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Truck, Eye, EyeOff, Loader2, UserCircle } from 'lucide-react';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'technician'>('technician');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
      toast.error(t('auth.fillAllFields'));
      return;
    }

    if (password.length < 6) {
      toast.error(t('auth.passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t('auth.passwordsNotMatch'));
      return;
    }

    setLoading(true);

    try {
      const success = await register(name, email, password, role);
      
      if (success) {
        toast.success(t('auth.registerSuccess'));
        navigate('/');
      } else {
        toast.error(t('auth.emailExists'));
      }
    } catch (error) {
      toast.error(t('auth.registerError'));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 14px',
    background: '#f5f5f7',
    border: '1.5px solid rgba(0,0,0,0.1)',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 500,
    color: '#1d1d1f',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, background 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#86868b',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#f5f5f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
      WebkitFontSmoothing: 'antialiased',
      position: 'relative',
    }}>
      <style>{`@keyframes reg-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Language Switcher */}
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        <LanguageSwitcher />
      </div>

      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo and Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, background: '#000000', borderRadius: 18,
            marginBottom: 16,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          }}>
            <Truck style={{ width: 30, height: 30, color: '#ffffff' }} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1d1d1f', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            {t('app.name')}
          </h1>
          <p style={{ fontSize: 15, color: '#86868b', margin: 0 }}>{t('auth.createAccount')}</p>
        </div>

        {/* Register Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: 20,
          border: '1px solid rgba(0,0,0,0.09)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05), 0 12px 40px rgba(0,0,0,0.08)',
          padding: '32px 28px',
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1d1d1f', margin: '0 0 24px', letterSpacing: '-0.3px' }}>
            {t('auth.register')}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Name */}
            <div>
              <label style={labelStyle}>{t('auth.fullName')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.fullNamePlaceholder')}
                required
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#000000'; e.target.style.background = '#ffffff'; }}
                onBlur={e  => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.background = '#f5f5f7'; }}
              />
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                required
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#000000'; e.target.style.background = '#ffffff'; }}
                onBlur={e  => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.background = '#f5f5f7'; }}
              />
            </div>

            {/* Role */}
            <div>
              <label style={labelStyle}>{t('auth.role')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(['admin', 'technician'] as const).map(r => {
                  const selected = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      style={{
                        padding: '14px 10px',
                        border: `2px solid ${selected ? '#000000' : 'rgba(0,0,0,0.1)'}`,
                        borderRadius: 12,
                        background: selected ? '#000000' : '#f5f5f7',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        fontFamily: 'inherit',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <UserCircle style={{ width: 22, height: 22, color: selected ? '#ffffff' : '#86868b' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: selected ? '#ffffff' : '#3d3d3f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t(`auth.${r}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>{t('auth.password')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  required
                  style={{ ...inputStyle, paddingRight: 48 }}
                  onFocus={e => { e.target.style.borderColor = '#000000'; e.target.style.background = '#ffffff'; }}
                  onBlur={e  => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.background = '#f5f5f7'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#86868b', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label style={labelStyle}>{t('auth.confirmPassword')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  required
                  style={{ ...inputStyle, paddingRight: 48 }}
                  onFocus={e => { e.target.style.borderColor = '#000000'; e.target.style.background = '#ffffff'; }}
                  onBlur={e  => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.background = '#f5f5f7'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#86868b', display: 'flex', alignItems: 'center' }}
                >
                  {showConfirmPassword ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                background: loading ? '#e5e5ea' : '#000000',
                color: loading ? '#aeaeb2' : '#ffffff',
                border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 700,
                fontFamily: 'inherit',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.15s',
                letterSpacing: '0.02em',
                marginTop: 4,
              }}
            >
              {loading && <Loader2 style={{ width: 18, height: 18, animation: 'reg-spin 0.9s linear infinite' }} />}
              {loading ? t('auth.registering') : t('auth.register')}
            </button>
          </form>

          {/* Login Link */}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#86868b', margin: 0 }}>
              {t('auth.haveAccount')}{' '}
              <Link to="/login" style={{ color: '#000000', fontWeight: 700, textDecoration: 'none' }}>
                {t('auth.loginNow')}
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 12, color: '#aeaeb2', marginTop: 24 }}>
          © 2026 FleetOps. {t('auth.allRightsReserved')}
        </p>
      </div>
    </div>
  );
}