import { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { useEmailTemplates } from '../../api/hooks';
import client from '../../api/client';

export default function EmailsPage() {
  const { data: templateData, isLoading: templatesLoading } = useEmailTemplates();
  const templates = templateData?.templates || [];

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
      setPreviewError(err.response?.data?.error || err.message);
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
      setSendResult({ ok: true, message: `Sent to ${res.data.to}` });
    } catch (err) {
      setSendResult({ ok: false, message: err.response?.data?.error || err.message });
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
                <p className={`mt-2 text-xs ${sendResult.ok ? 'text-green-600' : 'text-red-600'}`}>
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
