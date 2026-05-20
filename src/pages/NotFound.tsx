import { Link } from 'react-router';
import { Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">
          {t('notFound.code', '404')}
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          {t('notFound.title', 'Page not found')}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Home className="w-5 h-5" />
          {t('notFound.goHome', 'Go to Dashboard')}
        </Link>
      </div>
    </div>
  );
}
