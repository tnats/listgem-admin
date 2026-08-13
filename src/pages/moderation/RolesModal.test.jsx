import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import client from '../../api/client';
import RolesModal from './RolesModal';

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const USER = { user_id: 'u_susan', email: 'susan@listgem.com', username: 'susan', is_admin: false, is_moderator: false };

const save = () => screen.getByRole('button', { name: /save roles/i });

function open(user = USER, onDone = () => {}) {
  renderWithProviders(<RolesModal open user={user} onClose={() => {}} onDone={onDone} />);
}

describe('roles modal', () => {
  beforeEach(() => {
    client.post.mockReset();
  });

  it('will not submit an unchanged form', () => {
    open();
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'no-op' } });
    expect(save().disabled).toBe(true);
  });

  it('requires a reason — role changes are audited', () => {
    open();
    fireEvent.click(screen.getByLabelText(/Admin/i));
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'Onboarding Susan' } });
    expect(save().disabled).toBe(false);
  });

  it('sends both booleans and the reason', async () => {
    client.post.mockResolvedValue({ data: { success: true, user: { ...USER, is_admin: true }, changed: ['is_admin false -> true'], self: false } });
    const onDone = vi.fn();
    open(USER, onDone);

    fireEvent.click(screen.getByLabelText(/Admin/i));
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'Onboarding Susan' } });
    fireEvent.click(save());

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(client.post).toHaveBeenCalledWith('/admin/users/u_susan/roles', {
      is_admin: true,
      is_moderator: false,
      reason: 'Onboarding Susan',
    });
  });

  it('surfaces the last-admin 409 with the part that says what to do', async () => {
    // The endpoint puts the headline in `error` and the actionable half in
    // `message`; showing only the headline would hide the fix.
    client.post.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: 'Cannot remove the last admin',
          message: 'The portal is admin-only, so this would lock everyone out. Grant another admin first.',
        },
      },
    });
    open({ ...USER, is_admin: true });

    fireEvent.click(screen.getByLabelText(/Admin/i));
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'offboarding' } });
    fireEvent.click(save());

    expect(await screen.findByText(/Cannot remove the last admin/i)).toBeTruthy();
    expect(screen.getByText(/Grant another admin first/i)).toBeTruthy();
  });

  it('warns before you demote yourself out of the portal', () => {
    open({ ...USER, is_admin: true });
    fireEvent.click(screen.getByLabelText(/Admin/i));
    expect(screen.getByText(/won't be able to sign back in/i)).toBeTruthy();
  });
});
