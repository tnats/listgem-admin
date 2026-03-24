import { useState, useRef, useEffect, useCallback } from 'react';
import client from '../../api/client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const SOURCES = [
  { value: 'all', label: 'All Sources' },
  { value: 'tmdb', label: 'TMDB (Movies + TV)' },
  { value: 'spotify', label: 'Spotify (Songs + Artists + Albums)' },
  { value: 'googlebooks', label: 'Google Books' },
];

export default function SeedRunner({ onComplete }) {
  const [source, setSource] = useState('all');
  const [moviePages, setMoviePages] = useState(50);
  const [tvPages, setTvPages] = useState(25);
  const [dryRun, setDryRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const logEndRef = useRef(null);

  // Auto-scroll log area
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // SSE connection for progress
  const connectSSE = useCallback((id) => {
    const token = sessionStorage.getItem('token');
    const url = `${API_URL}/admin/seed/registry/progress/${id}`;

    const eventSource = new EventSource(url);
    // EventSource doesn't support headers, so we use a workaround:
    // close EventSource and use fetch-based SSE instead
    eventSource.close();

    // Use fetch with auth header for SSE
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.done) {
              setRunning(false);
              onComplete?.();
              return;
            }
            if (payload.line) {
              setLogs(prev => [...prev, payload.line]);
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      setRunning(false);
      onComplete?.();
    }).catch(() => {
      setRunning(false);
    });
  }, [onComplete]);

  async function handleStart() {
    setError('');
    setLogs([]);
    setRunning(true);

    try {
      const options = {};
      if (source === 'tmdb' || source === 'all') {
        options.moviePages = moviePages;
        options.tvPages = tvPages;
      }
      if (dryRun) options.dryRun = true;

      const { data } = await client.post('/admin/seed/registry', { source, options });
      setRunId(data.run_id);
      setLogs([`Seed run #${data.run_id} started (source: ${source})`]);
      connectSSE(data.run_id);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      setRunning(false);
      if (err.response?.data?.run_id) {
        setRunId(err.response.data.run_id);
      }
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Run Seed</h2>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Source</label>
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            disabled={running}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SOURCES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {(source === 'tmdb' || source === 'all') && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Movie Pages</label>
              <input
                type="number"
                value={moviePages}
                onChange={e => setMoviePages(parseInt(e.target.value) || 50)}
                disabled={running}
                min={1}
                max={500}
                className="w-24 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">TV Pages</label>
              <input
                type="number"
                value={tvPages}
                onChange={e => setTvPages(parseInt(e.target.value) || 25)}
                disabled={running}
                min={1}
                max={500}
                className="w-24 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </>
        )}

        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={e => setDryRun(e.target.checked)}
            disabled={running}
            className="rounded"
          />
          Dry run
        </label>

        <button
          onClick={handleStart}
          disabled={running}
          className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? 'Running...' : 'Start Seed'}
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {logs.length > 0 && (
        <div className="bg-gray-900 rounded p-3 max-h-64 overflow-y-auto font-mono text-xs text-green-400">
          {logs.map((line, i) => (
            <div key={i} className={line.startsWith('[stderr]') ? 'text-red-400' : ''}>
              {line}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
