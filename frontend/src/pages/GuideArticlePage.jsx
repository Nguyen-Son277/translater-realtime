import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Header } from '../components';
import { ArticleIcon, GuideBlocks } from '../components/GuideBlocks';
import { TOTAL, findArticle, neighbours } from '../guide';
import { useI18n } from '../i18n';

export function GuideArticlePage() {
  const { t, locale } = useI18n();
  const { slug } = useParams();
  const article = findArticle(slug);

  if (!article) {
    return <div className="guide-shell">
      <Header />
      <main className="guide-main">
        <div className="guide-missing">
          <h1>{t('guide.notFoundTitle')}</h1>
          <p className="muted">{t('guide.notFoundHint')}</p>
          <Link className="btn btn-primary" to="/guide">{t('guide.backToIndex')}</Link>
        </div>
      </main>
    </div>;
  }

  const { previous, next } = neighbours(article.slug);
  const content = article.blocks[locale] || article.blocks.vi;
  const titles = article.titles[locale] || article.titles.vi;
  const titleOf = item => item.titles[locale]?.title || item.titles.vi.title;

  return <div className="guide-shell">
    <Header />
    <main className="guide-main">
      <nav className="guide-breadcrumb" aria-label={t('guide.crumb')}>
        <Link to="/">{t('guide.backHome')}</Link>
        <ChevronRight size={15} aria-hidden="true" />
        <Link to="/guide">{t('guide.nav')}</Link>
        <ChevronRight size={15} aria-hidden="true" />
        <span>{titles.title}</span>
      </nav>

      <article className="guide-article" aria-labelledby="guide-article-title">
        <header className="guide-article-head">
          <span className="guide-article-meta">
            <span className="guide-card-icon" aria-hidden="true"><ArticleIcon name={article.icon} /></span>
            <span>{t('guide.position', { current: article.number, total: TOTAL })} · {t(`guide.category.${article.category}`)}</span>
          </span>
          <h1 id="guide-article-title">{titles.title}</h1>
          <p className="muted">{titles.summary}</p>
        </header>

        <GuideBlocks blocks={content} />

        <nav className="guide-article-nav" aria-label={t('guide.navLabel')}>
          {previous
            ? <Link className="guide-pager-btn" to={`/guide/${previous.slug}`}>
                <ChevronLeft size={18} aria-hidden="true" />
                <span><small>{t('guide.prev')}</small>{titleOf(previous)}</span>
              </Link>
            : <span className="guide-pager-spacer" aria-hidden="true" />}
          <Link className="guide-pager-all" to="/guide">{t('guide.backToIndex')}</Link>
          {next
            ? <Link className="guide-pager-btn align-end" to={`/guide/${next.slug}`}>
                <span><small>{t('guide.next')}</small>{titleOf(next)}</span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            : <span className="guide-pager-spacer" aria-hidden="true" />}
        </nav>
      </article>

      <footer className="guide-footer">
        <Link className="btn btn-secondary" to="/"><ArrowLeft size={18} aria-hidden="true" />{t('guide.backHome')}</Link>
        <Link className="btn btn-primary" to="/guide"><ArrowRight size={18} aria-hidden="true" />{t('guide.backToIndex')}</Link>
      </footer>
    </main>
  </div>;
}
