import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { SPEECH_DEFAULTS, SPEECH_FIELDS, validateSpeechSettings } from '../speechSettings';

const ENDPOINT = '/admin/settings/speech';
const toDraft = data => Object.fromEntries(SPEECH_FIELDS.map(({ key }) => [key, String(data[key])]));

export function SpeechSettingsCard() {
  const { t, formatLocale } = useI18n();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const applySaved = data => {
    setSaved(data);
    setDraft(toDraft(data));
    setConflict(false);
    setSubmitted(false);
  };

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setNotice(false);
    api(ENDPOINT).then(data => { if (active) applySaved(data); })
      .catch(() => { if (active) setError('loadError'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadVersion]);

  const { values, errors } = validateSpeechSettings(draft);
  const dirty = Boolean(saved && SPEECH_FIELDS.some(({ key }) => draft[key] !== String(saved[key])));
  const editDraft = next => { setDraft(next); setNotice(false); setError(''); };
  const save = async event => {
    event.preventDefault();
    if (!saved || saving || conflict || !dirty) return;
    setSubmitted(true); setError(''); setNotice(false);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const data = await api(ENDPOINT, { method: 'PATCH', body: { ...values, revision: saved.revision } });
      applySaved(data);
      setNotice(true);
    } catch (err) {
      if (err.status === 409) { setConflict(true); setError('conflict'); }
      else setError('saveError');
    } finally { setSaving(false); }
  };

  return <section className="speech-settings-card" aria-labelledby="speech-settings-heading" aria-busy={loading || saving}>
    <h2 id="speech-settings-heading">{t('speech.title')}</h2>
    <p className="muted">{t('speech.help')}</p>
    {loading && <div className="admin-loading" role="status"><span className="spinner" />{t('admin.loading')}</div>}
    {error && <div className="alert" role="alert">
      {t(`speech.${error}`)}
      {(error === 'loadError' || conflict) && <button type="button" className="text-button" disabled={loading || saving} onClick={() => setLoadVersion(value => value + 1)}>{t(conflict ? 'speech.reload' : 'common.retry')}</button>}
    </div>}
    {saved && <form onSubmit={save} noValidate>
      <fieldset disabled={loading || saving || conflict}>
        <div className="speech-settings-fields">
          {SPEECH_FIELDS.map(({ key, min, max }) => {
            const invalid = submitted && errors[key];
            const seconds = /^\d+$/.test(draft[key]) && Number.isFinite(Number(draft[key]))
              ? new Intl.NumberFormat(formatLocale, { maximumFractionDigits: 3 }).format(Number(draft[key]) / 1000) : '—';
            return <div className="speech-settings-field" key={key}>
              <label className="field-label" htmlFor={`speech-${key}`}>{t(`speech.${key}`)}</label>
              <input id={`speech-${key}`} name={key} type="number" inputMode="numeric" min={min} max={max} step={20} required value={draft[key]} onChange={event => editDraft({ ...draft, [key]: event.target.value })} aria-invalid={Boolean(invalid)} aria-describedby={`speech-${key}-seconds speech-${key}-help${invalid ? ` speech-${key}-error` : ''}`} />
              <p id={`speech-${key}-seconds`} className="field-help">{t('speech.seconds', { seconds })}</p>
              <p id={`speech-${key}-help`} className="field-help">{t(`speech.${key}Help`)} {t('speech.bounds', { min, max })}</p>
              {invalid && <p id={`speech-${key}-error`} className="speech-field-error" role="alert">{t(`speech.validation.${invalid}`, { min, max })}</p>}
            </div>;
          })}
        </div>
        <div className="speech-settings-actions">
          <button type="submit" className="btn btn-primary" disabled={!dirty || saving || loading || conflict}>{saving && <span className="spinner" />}{t('speech.save')}</button>
          <button type="button" className="btn btn-secondary" onClick={() => { editDraft(toDraft(SPEECH_DEFAULTS)); setSubmitted(false); }}>{t('speech.recommend')}</button>
        </div>
      </fieldset>
      <p className="field-help">{t('speech.applyHelp')}</p>
    </form>}
    {notice && <p className="form-success" role="status">{t('speech.saved')}</p>}
  </section>;
}
