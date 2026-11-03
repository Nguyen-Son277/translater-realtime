import { Sparkles } from 'lucide-react';
import { CommunityLayout } from '../components/Community';
import { useI18n } from '../i18n';
import { currentVersion, releases } from '../releases';

export function UpdatesPage() {
  const { t, locale, formatLocale } = useI18n();
  return <CommunityLayout title={t('community.updates')} intro={t('community.updatesIntro')}>
    <div className="release-current"><Sparkles size={22} aria-hidden="true" /><span>{t('community.current')} <strong>v{currentVersion}</strong></span></div>
    <div className="release-timeline">{releases.map(release => <article className="community-card release-card" key={release.version}>
      <header><span className="release-version">v{release.version}</span><h2>{release.title[locale]}</h2>{release.date && <time dateTime={release.date}>{new Date(`${release.date}T12:00:00`).toLocaleDateString(formatLocale)}</time>}</header>
      {['features', 'improvements', 'fixes'].filter(group => release[group]?.[locale]?.length).map(group => <section key={group}><h3>{t(`community.${group}`)}</h3><ul>{release[group][locale].map(item => <li key={item}>{item}</li>)}</ul></section>)}
    </article>)}</div>
  </CommunityLayout>;
}
