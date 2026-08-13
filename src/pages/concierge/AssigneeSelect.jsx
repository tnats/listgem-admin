import { Select } from '../../components/Form';
import { useAdminUsers } from '../../api/hooks';

/**
 * Assignee picker, sourced from the portal's own staff accounts.
 *
 * `assigned_to` is free text server-side and the board filters it with an exact
 * string match (`WHERE assigned_to = $n`), so a typo returns an empty board with
 * no error — which reads as "nothing assigned" rather than "you typed it
 * differently". A closed list of real accounts removes the failure mode instead
 * of documenting it.
 *
 * Values already on existing pitches stay selectable via `extra`, so nothing
 * typed before this existed becomes unreachable.
 */
export default function AssigneeSelect({ id, value, onChange, extra = [], placeholder = 'Unassigned' }) {
  const { data } = useAdminUsers({ limit: 200 });

  const staff = (data?.users || [])
    .filter(u => u.is_admin || u.is_moderator)
    .map(u => u.email)
    .filter(Boolean);

  const options = [...new Set([...staff, ...extra.filter(Boolean), value].filter(Boolean))]
    .sort()
    .map(v => ({ value: v, label: v }));

  return (
    <Select id={id} value={value || ''} onChange={onChange} placeholder={placeholder} options={options} />
  );
}
