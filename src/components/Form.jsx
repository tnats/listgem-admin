/**
 * Form primitives. Concierge is the first heavily interactive admin surface —
 * these keep intake, the builder and the verification dialogs on one set of
 * control styles instead of re-typing the same Tailwind string per input.
 */

const CONTROL =
  'w-full px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900 placeholder:text-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400';

const VARIANTS = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 border border-transparent',
  secondary: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 border border-transparent',
  ghost: 'border border-transparent text-gray-500 hover:bg-gray-100',
};

const BUTTON_SIZES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

export function Field({ label, hint, required, error, htmlFor, children }) {
  return (
    <div className="mb-3">
      {label && (
        <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-gray-600">
          {label}
          {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>
      )}
    </div>
  );
}

export function TextInput({ className = '', ...props }) {
  return <input type="text" className={`${CONTROL} ${className}`} {...props} />;
}

export function TextArea({ rows = 3, className = '', ...props }) {
  return <textarea rows={rows} className={`${CONTROL} ${className}`} {...props} />;
}

export function Select({ options = [], placeholder, className = '', ...props }) {
  return (
    <select className={`${CONTROL} ${className}`} {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => {
        const value = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return (
          <option key={value} value={value}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

export function Checkbox({ label, hint, id, ...props }) {
  return (
    <label htmlFor={id} className="mb-2 flex cursor-pointer items-start gap-2">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm text-gray-800">{label}</span>
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </span>
    </label>
  );
}

export function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`rounded font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
        BUTTON_SIZES[size] || BUTTON_SIZES.md
      } ${VARIANTS[variant] || VARIANTS.secondary} ${className}`}
      {...props}
    />
  );
}
