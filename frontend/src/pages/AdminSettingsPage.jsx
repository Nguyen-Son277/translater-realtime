import { useEffect, useState } from 'react';
import { api } from '../api';
import { Header } from '../components';
import { AdminNavigation } from '../components/AdminNavigation';
import { SpeechSettingsCard } from '../components/SpeechSettingsCard';
import { useI18n } from '../i18n';

const ENDPOINT = '/admin/settings/translation';
const TEST_ERRORS = new Set(['not_configured', 'upstream_auth', 'rate_limited', 'timeout', 'unavailable', 'invalid_response']);

export function AdminSettingsPage() {
  const { t } = useI18n();
  const [saved, setSaved] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [removeKey, setRemoveKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);

  const applySaved = data => {
    // Only consume public metadata. Never copy any returned credential into the form.
    setSaved({ base_url: data.base_url || '', model: data.model || '', api_key_configured: Boolean(data.api_key_configured), configured: Boolean(data.configured), revision: data.revision });
    setBaseUrl(data.base_url || '');
    setModel(data.model || '');
    setApiKey('');
    setRemoveKey(false);
    setConflict(false);
  };
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setNotice('');
    api(ENDPOINT).then(data => { if (active) applySaved(data); })
      .catch(() => { if (active) setError('loadError'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadVersion]);

  const dirty = Boolean(saved && (baseUrl !== saved.base_url || model !== saved.model || apiKey || removeKey));
  const editing = () => { setError(''); setNotice(''); };
  const save = async event => {
    event.preventDefault();
    setError(''); setNotice('');
    const url = baseUrl.trim();
    if (url) {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || /\s/.test(url)) throw new Error();
      } catch { setError('invalidUrl'); return; }
    }
    setBusy('save');
    try {
      const body = { base_url: url, model: model.trim(), revision: saved.revision };
      if (removeKey) body.api_key = '';
      else if (apiKey) body.api_key = apiKey;
      const data = await api(ENDPOINT, { method: 'PATCH', body });
      applySaved(data);
      setNotice('saved');
    } catch (err) {
      if (err.status === 409) { setConflict(true); setError('conflict'); }
      else setError('saveError');
    } finally { setBusy(''); }
  };
  const testSaved = async () => {
    setBusy('test'); setError(''); setNotice('');
    try {
      const result = await api(`${ENDPOINT}/test`, { method: 'POST' });
      if (result?.status === 'ok') setNotice('testSuccess');
      else setError('testError');
    } catch (err) {
      // Render allowlisted codes only: upstream details may contain credentials.
      setError(TEST_ERRORS.has(err.message) ? `test.${err.message}` : 'testError');
    } finally { setBusy(''); }
  };

  return <div className="admin-shell">
    <Header />
    <main className="admin-main">
      <AdminNavigation />
      <header className="admin-heading">
        <h1>{t('settings.title')}</h1>
        <p className="muted">{t('settings.subtitle')}</p>
      </header>
      {loading ? <div className="admin-loading" role="status"><span className="spinner" />{t('admin.loading')}</div> : <>
        {error && <div className="alert" role="alert">
          {t(`settings.${error}`)}
          {(error === 'loadError' || conflict) && <button className="text-button" type="button" disabled={Boolean(busy)} onClick={() => setLoadVersion(value => value + 1)}>{t(conflict ? 'settings.reload' : 'common.retry')}</button>}
        </div>}
        {saved && error !== 'loadError' && <section className="translation-settings-card" aria-labelledby="translation-settings-heading">
          <div className="translation-settings-heading">
            <h2 id="translation-settings-heading">{t('settings.gateway')}</h2>
            <span className={`admin-badge ${saved.configured ? 'admin-badge-active' : 'admin-badge-locked'}`}>{t(saved.configured ? 'settings.configured' : 'settings.notConfigured')}</span>
          </div>
          <p className="muted">{t('settings.gatewayHelp')}</p>
          <form onSubmit={save} aria-busy={Boolean(busy)}>
            <fieldset disabled={Boolean(busy) || conflict}>
              <label className="field-label" htmlFor="translation-base-url">{t('settings.baseUrl')}</label>
              <input id="translation-base-url" name="base_url" type="url" maxLength={2048} value={baseUrl} onChange={event => { setBaseUrl(event.target.value); editing(); }} placeholder="https://api.example.com/v1" autoComplete="off" spellCheck={false} aria-describedby="translation-url-help" />
              <p id="translation-url-help" className="field-help">{t('settings.baseUrlHelp')}</p>
              <label className="field-label" htmlFor="translation-model">{t('settings.model')}</label>
              <input id="translation-model" name="model" maxLength={200} value={model} onChange={event => { setModel(event.target.value); editing(); }} autoComplete="off" spellCheck={false} />
              <label className="field-label" htmlFor="translation-api-key">{t('settings.apiKey')}</label>
              <input id="translation-api-key" name="translation_api_key" type="password" maxLength={8192} value={apiKey} onChange={event => { setApiKey(event.target.value); editing(); }} disabled={Boolean(busy) || removeKey || conflict} autoComplete="new-password" spellCheck={false} aria-describedby="translation-key-help translation-key-status" />
              <p id="translation-key-status" className="field-help">{t(saved.api_key_configured ? 'settings.keyConfigured' : 'settings.keyMissing')}</p>
              <p id="translation-key-help" className="field-help">{t('settings.apiKeyHelp')}</p>
              {saved.api_key_configured && <label className="settings-checkbox" htmlFor="translation-remove-key">
                <input id="translation-remove-key" type="checkbox" checked={removeKey} onChange={event => { setRemoveKey(event.target.checked); setApiKey(''); editing(); }} />
                <span>{t('settings.removeKey')}</span>
              </label>}
              {removeKey && <p className="field-help settings-warning">{t('settings.removeKeyWarning')}</p>}
              <div className="translation-settings-actions">
                <button type="submit" className="btn btn-primary" disabled={!dirty || Boolean(busy) || conflict}>{busy === 'save' && <span className="spinner" />}{t('settings.save')}</button>
                <button type="button" className="btn btn-secondary" onClick={testSaved} disabled={!saved.configured || dirty || Boolean(busy) || conflict}>{busy === 'test' && <span className="spinner" />}{t('settings.test')}</button>
              </div>
            </fieldset>
            <p className="field-help">{t(dirty ? 'settings.unsavedHelp' : 'settings.testHelp')}</p>
          </form>
          {notice && <p className="form-success" role="status">{t(`settings.${notice}`)}</p>}
        </section>}
      </>}
      <SpeechSettingsCard />
    </main>
  </div>;
}
