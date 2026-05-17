/**
 * Utilidades de formato de números y monedas.
 * Usa locale es-PY (Paraguay): separador de miles con punto, decimales con coma.
 *
 * Disponible globalmente (cargado antes que las páginas).
 */

/**
 * Formatea un número como moneda con separador de miles.
 * Soporta strings o números. Si el valor es null/undefined/NaN devuelve "0".
 *
 *   formatMoney(1234567)      -> "1.234.567"
 *   formatMoney("1234.5")     -> "1.234,5"
 *   formatMoney(null)         -> "0"
 */
function formatMoney(value, options = {}) {
    const n = Number(value);
    if (value === null || value === undefined || Number.isNaN(n)) return '0';
    const { maximumFractionDigits = 2 } = options;
    return n.toLocaleString('es-PY', { maximumFractionDigits });
}

/**
 * Formatea un número entero con separador de miles (sin decimales).
 *   formatInt(1234567)   -> "1.234.567"
 */
function formatInt(value) {
    return formatMoney(value, { maximumFractionDigits: 0 });
}

/**
 * Formatea un monto en Guaraníes con el prefijo "Gs." (sin decimales,
 * los Gs. en la práctica no los usan).
 *   formatGs(1234567)   -> "Gs. 1.234.567"
 *   formatGs(null)      -> "Gs. 0"
 */
function formatGs(value) {
    return `Gs. ${formatMoney(value, { maximumFractionDigits: 0 })}`;
}

/**
 * Formatea una fecha SIN conversión de zona horaria.
 *
 * Acepta strings "YYYY-MM-DD" o "YYYY-MM-DDTHH:MM:SS" (con o sin Z)
 * y devuelve "DD/MM/YYYY" usando exactamente los números del string,
 * evitando el clásico bug de `new Date("2026-01-05").toLocaleDateString()`
 * que corre la fecha un día cuando el navegador está en una TZ al oeste
 * de UTC.
 *
 *   formatDate("2026-01-05")           -> "05/01/2026"
 *   formatDate("2026-01-05T12:00:00")  -> "05/01/2026"
 *   formatDate(null)                   -> ""
 */
function formatDate(value) {
    if (!value) return '';
    const s = String(value);
    // Extraer los primeros 10 chars como YYYY-MM-DD
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;  // Si no matchea, devolver como vino
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
}
