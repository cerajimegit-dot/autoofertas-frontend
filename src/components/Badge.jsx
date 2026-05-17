/**
 * Badge — etiqueta coloreada para estados, categorías y flags.
 *
 * Uso directo:
 *   <Badge intent="success">Activo</Badge>
 *   <Badge intent="warning">Pendiente</Badge>
 *   <Badge intent="danger">Vencida</Badge>
 *   <Badge intent="info">Crédito</Badge>
 *   <Badge intent="neutral">Cancelada</Badge>
 *
 * Helpers para mapear status → badge:
 *   {saleStatusBadge(sale.status, sale.status_display)}
 *   {quotaStatusBadge(quota.status, quota.status_display)}
 *   {vehicleStateBadge(v.state, v.state_display)}
 *   {paymentFormBadge(sale.payment_form_name)}
 */
function Badge({ intent = 'neutral', children, className = '' }) {
    const styles = {
        success: 'bg-green-100 text-green-800',
        warning: 'bg-yellow-100 text-yellow-800',
        danger:  'bg-red-100 text-red-800',
        // info es distinto de danger — sky es azul info clásico, no confundible
        // con el rojo del tema (que ahora es la marca y "danger" a la vez).
        info:    'bg-sky-100 text-sky-800',
        purple:  'bg-purple-100 text-purple-800',
        amber:   'bg-amber-100 text-amber-800',
        neutral: 'bg-gray-100 text-gray-700',
    };
    return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[intent] || styles.neutral} ${className}`}>
            {children}
        </span>
    );
}

/* ---------- Helpers para estados del dominio ---------- */

function saleStatusBadge(status, display) {
    // Status del CONTRATO de la venta:
    //   - completed → "Cerrada" (gris-azulado, neutro — venta firmada)
    //   - pending   → "Reserva" (warning, seña sin cerrar)
    //   - cancelled → "Cancelada" (neutro tachado)
    // El estado real de COBRANZA va aparte en collectionStatusBadge.
    const map = {
        completed: 'info',     // contrato cerrado, no implica cobrada
        pending:   'warning',  // reserva
        cancelled: 'neutral',  // anulada
    };
    return <Badge intent={map[status] || 'neutral'}>{display || status}</Badge>;
}

/* Estado de cobranza — distinto del status del contrato.
   Refleja qué tan cobrada está la venta hoy. */
function collectionStatusBadge(collection_status, display, summary) {
    if (!collection_status) return null;
    const map = {
        paid_full:   'success',  // ✓ Cobrada total
        collecting:  'info',     // 💵 Cobrando parcial
        overdue:     'danger',   // ⚠ Con vencidas
        unpaid:      'amber',    // sin cobros aún (cuotas pero ninguna paga)
        no_plan:     'neutral',  // sin plan de cuotas
        cancelled:   'neutral',
    };
    const icon = {
        paid_full:   '✓',
        collecting:  '💵',
        overdue:     '⚠',
        unpaid:      '⏳',
        no_plan:     '—',
    }[collection_status] || '';
    let label = display || collection_status;
    // Agregar info concreta cuando hay summary
    if (summary && summary.n_total > 0 && collection_status !== 'paid_full') {
        label = `${label} ${summary.n_paid}/${summary.n_total}`;
    }
    return <Badge intent={map[collection_status] || 'neutral'}>{icon} {label}</Badge>;
}

function quotaStatusBadge(status, display, isOverdue) {
    let intent = 'warning';
    if (status === 'paid') intent = 'success';
    else if (status === 'cancelled') intent = 'neutral';
    else if (status === 'overdue' || isOverdue) intent = 'danger';
    return <Badge intent={intent}>{display || status}</Badge>;
}

function vehicleStateBadge(state, display) {
    const map = {
        available:   'success',
        reserved:    'warning',
        sold:        'neutral',
        maintenance: 'info',
    };
    return <Badge intent={map[state] || 'neutral'}>{display || state}</Badge>;
}

function paymentFormBadge(name) {
    const upper = (name || '').toUpperCase();
    if (upper.includes('CONTADO'))  return <Badge intent="success">Contado</Badge>;
    if (upper.includes('CRED'))     return <Badge intent="info">Crédito</Badge>;
    if (upper.includes('MIXTO'))    return <Badge intent="purple">Mixto</Badge>;
    return <Badge intent="neutral">{name || 'Sin forma'}</Badge>;
}

function userRoleBadge(role, display) {
    const map = {
        admin:   'danger',
        manager: 'info',
        vendor:  'neutral',
    };
    return <Badge intent={map[role] || 'neutral'}>{display || role}</Badge>;
}
