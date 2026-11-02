import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';

// The password endpoint always requires the current password, including after
// an administrator reset. Admin resets use their own endpoint and modal.
export function PasswordForm({ submitLabel, onSuccess, onCancel }) {
  const { t, localizeError } = useI18n();
  const uid = useId();
  const [visible, setVisible] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [success, setSuccess] = useState(false);
  const submit = async event => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setError(''); setValidation(''); setSuccess(false);
    const current = String(form.get('current_password') || '');
    const password = String(form.get('new_password') || '');
    const confirmation = String(form.get('new_password_confirmation') || '');
    if (password !== confirmation) { setValidation('auth.passwordMismatch'); return; }
    if (password === current) { setValidation('password.different'); return; }
    setBusy(true);
    try {
      const account = await api('/auth/password', {
        method: 'POST',
        body: { current_password: current, new_password: password, new_password_confirmation: confirmation },
      });
      element.reset();
      setVisible({});
      setSuccess(true);
      await onSuccess?.(account);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const fields = [
    ['current_password', 'password.current', 'password.currentPlaceholder', 'current-password'],
    ['new_password', 'password.new', 'password.newPlaceholder', 'new-password'],
    ['new_password_confirmation', 'password.confirm', 'password.confirmPlaceholder', 'new-password'],
  ];
  return <form className="password-form" onSubmit={submit} onChange={() => { setError(''); setValidation(''); setSuccess(false); }}>
    {fields.map(([name, label, placeholder, autocomplete]) => <div key={name}>
      <label className="field-label" htmlFor={`${uid}-${name}`}>{t(label)}</label>
      <div className="password-input">
        <input id={`${uid}-${name}`} name={name} type={visible[name] ? 'text' : 'password'} placeholder={t(placeholder)} autoComplete={autocomplete} required minLength={8} maxLength={128} disabled={busy} />
        <button type="button" className="icon-btn" onClick={() => setVisible(value => ({ ...value, [name]: !value[name] }))} aria-label={t(name === 'new_password_confirmation' ? (visible[name] ? 'auth.confirmHide' : 'auth.confirmShow') : (visible[name] ? 'auth.passwordHide' : 'auth.passwordShow'))} aria-pressed={Boolean(visible[name])}>{visible[name] ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      </div>
    </div>)}
    {(error || validation) && <p className="form-error" role="alert">{validation ? t(validation) : localizeError(error)}</p>}
    {success && <p className="form-success" role="status">{t('password.success')}</p>}
    <div className="password-submit-row">
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> {t('password.submitting')}</> : (submitLabel || t('password.submit'))}</button>
      {onCancel && <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>{t('admin.cancel')}</button>}
    </div>
  </form>;
}
