/**
 * FormField — input con validación inline (al blur).
 *
 * Uso:
 *   <FormField
 *     label="VIN"
 *     value={form.vin}
 *     onChange={v => setForm({ ...form, vin: v })}
 *     required
 *     minLength={5}
 *     maxLength={50}
 *     hint="Número de chasis del vehículo"
 *   />
 *
 * Para validaciones custom: pasar `validate` que devuelve un mensaje de error
 * o null si está OK.
 *
 *   <FormField
 *     label="Email"
 *     value={form.email}
 *     onChange={...}
 *     type="email"
 *     validate={v => /^[^@]+@[^@]+\.[^@]+$/.test(v) ? null : 'Email inválido'}
 *   />
 */
function FormField({
    label, value, onChange,
    type = 'text', placeholder = '',
    required = false, disabled = false,
    minLength, maxLength, min, max, step,
    validate,
    hint,
    autoFocus = false,
    rows = 0,         // > 0 → textarea
    className = '',
    inputClassName = '',
}) {
    const [touched, setTouched] = React.useState(false);
    const [error, setError] = React.useState(null);

    function check(val) {
        if (required && !String(val ?? '').trim()) return 'Requerido';
        if (minLength && String(val).length < minLength) return `Mínimo ${minLength} caracteres`;
        if (maxLength && String(val).length > maxLength) return `Máximo ${maxLength} caracteres`;
        if (type === 'number' && val !== '' && val !== null && val !== undefined) {
            const n = Number(val);
            if (Number.isNaN(n)) return 'Debe ser un número';
            if (min != null && n < min) return `Mínimo ${min}`;
            if (max != null && n > max) return `Máximo ${max}`;
        }
        if (type === 'email' && val && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) {
            return 'Email inválido';
        }
        if (validate) return validate(val);
        return null;
    }

    function onBlur() {
        setTouched(true);
        setError(check(value));
    }

    function onInput(e) {
        const v = e.target.value;
        onChange(v);
        if (touched) setError(check(v));  // re-validar mientras escribe si ya tocó
    }

    const showError = touched && error;
    const baseInputClass = `w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 transition ${
        showError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-red-300'
    } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${inputClassName}`;

    return (
        <div className={className}>
            {label && (
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
            )}
            {rows > 0 ? (
                <textarea
                    value={value ?? ''}
                    onChange={onInput}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={rows}
                    autoFocus={autoFocus}
                    className={baseInputClass}
                />
            ) : (
                <input
                    type={type}
                    value={value ?? ''}
                    onChange={onInput}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    minLength={minLength}
                    maxLength={maxLength}
                    min={min}
                    max={max}
                    step={step}
                    autoFocus={autoFocus}
                    className={baseInputClass}
                />
            )}
            {showError ? (
                <p className="text-xs text-red-600 mt-1">⚠ {error}</p>
            ) : hint ? (
                <p className="text-xs text-gray-500 mt-1">{hint}</p>
            ) : null}
        </div>
    );
}
