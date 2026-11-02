import { ArrowRight, ChevronRight, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '../components';
import { ArticleIcon } from '../components/GuideBlocks';
import { TOTAL, groupedArticles } from '../guide';
import { useI18n } from '../i18n';

export function GuideIndexPage() {
  const { t, locale } = useI18n();
  const groups = groupedArticles();
  const titleOf = article => article.titles[locale]?.title || article.titles.vi.title;
  const summaryOf = article => article.titles[locale]?.summary || article.titles.vi.summary;
  return <div className="guide-shell">
    <Header />
    <main className="guide-main">
      <nav className="guide-breadcrumb" aria-label={t('guide.crumb')}>
        <Link to="/">{t('guide.backHome')}</Link>
        <ChevronRight size={15} aria-hidden="true" />
        <span>{t('guide.nav')}</span>
      </nav>

      <header className="guide-hero guide-index-hero">
        <span className="guide-hero-icon" aria-hidden="true"><LayoutGrid size={26} /></span>
        <h1>{t('guide.title')}</h1>
        <p className="muted">{t('guide.subtitle')}</p>
        <p className="guide-count">{t('guide.articleCount', { count: TOTAL })}</p>
      </header>

      <div className="guide-groups">
        {groups.map(group => <section className="guide-group" key={group.category} aria-labelledby={`guide-group-${group.category}`}>
          <div className="guide-group-head">
            <h2 id={`guide-group-${group.category}`}>{t(`guide.category.${group.category}`)}</h2>
            <span className="guide-group-count">{group.items.length}</span>
          </div>
          <ul className="guide-cards">
            {group.items.map(article => <li key={article.slug}>
              <Link className="guide-card" to={`/guide/${article.slug}`}>
                <span className="guide-card-icon" aria-hidden="true"><ArticleIcon name={article.icon} /></span>
                <span className="guide-card-body">
                  <span className="guide-card-number" aria-hidden="true">{String(article.number).padStart(2, '0')}</span>
                  <strong>{titleOf(article)}</strong>
                  <span className="guide-card-summary">{summaryOf(article)}</span>
                  <span className="guide-card-cta">{t('guide.openArticle')} <ArrowRight size={16} aria-hidden="true" /></span>
                </span>
              </Link>
            </li>)}
          </ul>
        </section>)}
      </div>

      <footer className="guide-footer">
        <Link className="btn btn-secondary" to="/">{t('guide.backHome')}</Link>
      </footer>
    </main>
  </div>;
}
