'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage()

  return (
    <div className="flex items-center gap-1.5 text-action-l">
      <button
        onClick={() => setLang('ko')}
        aria-pressed={lang === 'ko'}
        className={lang === 'ko' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}
      >
        한국어
      </button>
      <span className="text-slate-300">|</span>
      <button
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        className={lang === 'en' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}
      >
        EN
      </button>
    </div>
  )
}
