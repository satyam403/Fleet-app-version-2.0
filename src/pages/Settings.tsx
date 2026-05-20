import { useTranslation } from 'react-i18next';
import { Globe, Bell, User, Palette } from 'lucide-react';

export function Settings() {
  const { i18n, t } = useTranslation();

  const languages = [
    { code: 'en', label: t('settings.english'), flag: '🇺🇸' },
    { code: 'es', label: t('settings.spanish'), flag: '🇪🇸' },
    { code: 'es-MX', label: t('settings.spanishMX'), flag: '🇲🇽' },
  ];

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('fleetops-language', code);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>

      {/* Language Settings */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-6 h-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('settings.language')}</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">{t('settings.selectLanguage')}</p>

        <div className="space-y-3">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                i18n.language === lang.code
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{lang.flag}</span>
                <span className="font-medium text-gray-900">{lang.label}</span>
              </div>
              {i18n.language === lang.code && (
                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Appearance Settings (Placeholder) */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 opacity-60">
        <div className="flex items-center gap-3 mb-4">
          <Palette className="w-6 h-6 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('settings.appearance')}</h2>
        </div>
        <p className="text-sm text-gray-500">Coming soon...</p>
      </div>

      {/* Notifications Settings (Placeholder) */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 opacity-60">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-6 h-6 text-yellow-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('settings.notifications')}</h2>
        </div>
        <p className="text-sm text-gray-500">Coming soon...</p>
      </div>

      {/* Account Settings (Placeholder) */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 opacity-60">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-6 h-6 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('settings.account')}</h2>
        </div>
        <p className="text-sm text-gray-500">Coming soon...</p>
      </div>
    </div>
  );
}
