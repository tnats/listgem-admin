import { useState, useEffect, useMemo } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { useEmailTemplates } from '../../api/hooks';
import { apiErrorMessage } from '../../api/errors';
import client from '../../api/client';

export default function EmailsPage() {
  const { data: templateData, isLoading: templatesLoading } = useEmailTemplates();
  const templates = useMemo(() => templateData?.templates || [], [templateData]);

  const [selected, setSelected] = useState('');
  const [fields, setFields] = useState({});
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [previewTab, setPreviewTab] = useState('html');
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Auto-select first template once loaded
  useEffect(() => {
    if (templates.length > 0 && !selected) {
      setSelected(templates[0].key);
    }
  }, [templates, selected]);

  // Populate fields when template selection changes
  useEffect(() => {
    if (!selected || templates.length === 0) return;
    const tpl = templates.find(t => t.key === selected);
    if (tpl) setFields({ ...tpl.fields });
  }, [selected, templates]);

  async function handlePreview() {
    setLoading(true);
    setPreviewError('');
    setPreviewHtml('');
    setPreviewSubject('');
    setPreviewText('');
    try {
      const res = await client.post('/admin/email/preview', { template: selected, data: fields });
      setPreviewHtml(res.data.html);
      setPreviewSubject(res.data.subject);
      setPreviewText(res.data.text);
    } catch (err) {
      setPreviewError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTest() {
    if (!testEmail) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await client.post('/admin/email/send-test', { template: selected, data: fields, to: testEmail });
      const { delivery, provider_id: providerId, to } = res.data;
      // The API distinguishes three outcomes (#561). "Sent" used to cover all
      // of them, so a send that never happened read as a success — and a
      // genuine send that landed in spam was indistinguishable from one that
      // was silently dropped.
      if (delivery === 'skipped_no_api_key') {
        setSendResult({ ok: false, message: 'Not sent — the server has no RESEND_API_KEY configured.' });
      } else if (delivery === 'skipped_dev_mode') {
        setSendResult({ ok: false, message: 'Not sent — the server is not running in production mode; it logged the message instead.' });
      } else if (delivery === 'queued') {
        // Deliberately not "delivered": Resend has accepted it, and bounces and
        // spam placement happen after that.
        setSendResult({
          ok: true,
          message: `Accepted by Resend for ${to}${providerId ? ` · id ${providerId}` : ''}. Check spam if it doesn't arrive — a [TEST] subject is itself a spam signal.`,
        });
      } else {
        // No `delivery` at all. Reading that as success is the exact mistake
        // this page just stopped making: an API that doesn't say what happened
        // has not told us that anything did. Older builds answered a bare
        // { sent: true }, so this is what a pre-#561 server looks like.
        setSendResult({
          unknown: true,
          message: `The request was accepted for ${to}, but the API didn't report an outcome — no delivery state and no provider id. This server predates the change that reports them, so whether it sent is unknown. Check the inbox, and the Resend dashboard.`,
        });
      }
    } catch (err) {
      // The API answers { error: 'Send failed', message: <the actual cause> }.
      // Showing only `error` reduced every failure to a label — "Send failed",
      // with the SMTP reason or the template's own exception thrown away.
      setSendResult({ ok: false, message: apiErrorMessage(err) });
    } finally {
      setSending(false);
    }
  }

  function updateField(key, value) {
    setFields(prev => ({ ...prev, [key]: value }));
  }

  const currentTemplate = templates.find(t => t.key === selected);

  if (templatesLoading) {
    return (
      <div>
        <PageHeader title="Email Templates" description="Preview and test email templates" />
        <div className="text-sm text-gray-400">Loading templates...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Email Templates" description="Preview and test email templates" />

      <div className="grid grid-cols-3 gap-6">
        {/* Left panel — template selector + fields */}
        <div className="space-y-4">
          {/* Template selector */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Template</label>
            <select
              value={selected}
              onChange={e => { setSelected(e.target.value); setPreviewHtml(''); setPreviewSubject(''); setSendResult(null); }}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {templates.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Editable sample data */}
          {currentTemplate && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Sample Data</label>
              <div className="space-y-3">
                {Object.entries(fields).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1 font-mono">{key}</label>
                    <input
                      type="text"
                      value={value}
                      onChange={e => updateField(key, e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <button
              onClick={handlePreview}
              disabled={loading || !selected}
              className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Rendering...' : 'Preview'}
            </button>

            <div className="border-t border-gray-100 pt-3">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Send Test</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={handleSendTest}
                  disabled={sending || !testEmail || !selected}
                  className="px-4 py-1.5 bg-gray-800 text-white text-sm rounded hover:bg-gray-900 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
              {sendResult && (
                <p
                  className={`mt-2 text-xs ${
                    sendResult.unknown ? 'text-amber-700' : sendResult.ok ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {sendResult.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right panel — preview (2 cols wide) */}
        <div className="col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Subject bar */}
            {previewSubject && (
              <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                <span className="text-xs text-gray-500">Subject: </span>
                <span className="text-sm font-medium text-gray-900">{previewSubject}</span>
              </div>
            )}

            {/* Tab bar */}
            <div className="flex border-b border-gray-200">
              {['html', 'text'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setPreviewTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 ${
                    previewTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'html' ? 'HTML Preview' : 'Plain Text'}
                </button>
              ))}
            </div>

            {/* Preview content */}
            <div>
              {previewError && (
                <div className="p-4">
                  <StatusBadge status="failed" />
                  <span className="ml-2 text-sm text-red-600">{previewError}</span>
                </div>
              )}

              {!previewHtml && !previewError && (
                <div className="p-12 text-center text-sm text-gray-400">
                  Select a template and click Preview to render it
                </div>
              )}

              {previewHtml && previewTab === 'html' && (
                <iframe
                  srcDoc={previewHtml}
                  title="Email preview"
                  className="w-full border-0"
                  style={{ minHeight: 600 }}
                  sandbox=""
                />
              )}

              {previewText && previewTab === 'text' && (
                <pre className="p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50" style={{ minHeight: 600 }}>
                  {previewText}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
