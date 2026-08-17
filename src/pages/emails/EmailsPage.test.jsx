import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import client from '../../api/client';
import EmailsPage from './EmailsPage';

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const TEMPLATES = {
  templates: [{ key: 'welcome', label: 'Welcome', fields: { username: 'New User', loginUrl: 'https://x/' } }],
};

async function open() {
  renderWithProviders(<EmailsPage />);
  await screen.findByText('Welcome');
  fireEvent.change(screen.getByPlaceholderText(/recipient@/i), { target: { value: 'tim@example.com' } });
}

describe('email send-test outcomes', () => {
  beforeEach(() => {
    client.get.mockReset();
    client.post.mockReset();
    client.get.mockResolvedValue({ data: TEMPLATES });
  });

  const send = () => fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

  it('reports acceptance without claiming delivery', async () => {
    client.post.mockResolvedValue({ data: { sent: true, delivery: 'queued', provider_id: 're_123', to: 'tim@example.com' } });
    await open();
    send();
    // "Sent" overclaims: Resend accepting a message says nothing about bounces
    // or spam placement, which is exactly where the last one went.
    expect(await screen.findByText(/Accepted by Resend for tim@example.com · id re_123/)).toBeTruthy();
  });

  it('does not call a skipped send a success', async () => {
    client.post.mockResolvedValue({ data: { sent: false, delivery: 'skipped_no_api_key', provider_id: null, to: 'tim@example.com' } });
    await open();
    send();
    expect(await screen.findByText(/Not sent — the server has no RESEND_API_KEY/i)).toBeTruthy();
  });

  it('names dev mode rather than reporting success', async () => {
    client.post.mockResolvedValue({ data: { sent: false, delivery: 'skipped_dev_mode', provider_id: null, to: 'tim@example.com' } });
    await open();
    send();
    expect(await screen.findByText(/not running in production mode/i)).toBeTruthy();
  });

  it('distinguishes a template failure from a send failure', async () => {
    client.post.mockRejectedValue({
      response: { status: 500, data: { error: 'Template render failed', template: 'welcome', message: "Cannot read properties of undefined (reading 'map')" } },
    });
    await open();
    send();
    expect(await screen.findByText(/Template render failed.*reading 'map'/s)).toBeTruthy();
  });
});
