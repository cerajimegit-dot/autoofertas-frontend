/**
 * Imprimir un cronograma de cuotas como PDF — vía el navegador.
 *
 * Por qué frontend en lugar de generar el PDF en el backend:
 *   1. Cero dependencias nuevas (sin reportlab/weasyprint en el server).
 *   2. Cero cold start: la generación es instantánea en el browser.
 *   3. El usuario puede ajustar márgenes, elegir impresora, guardar
 *      como PDF, todo desde el diálogo nativo "Imprimir" del navegador.
 *   4. Funciona offline (los datos ya están en pantalla).
 *
 * El truco: abrimos una pestaña nueva, escribimos un HTML autocontenido
 * con CSS para impresión (`@media print`, márgenes A4), llamamos a
 * window.print() después de un pequeño delay (para que el render
 * termine), y el usuario hace "Guardar como PDF" desde ahí.
 *
 * NOTA: `window.open(..., '_blank')` puede ser bloqueado por el popup
 * blocker si no se dispara desde un click real del usuario. Por eso
 * esta función debe llamarse SIEMPRE dentro de un onClick — no desde
 * efectos ni timeouts.
 */

(function () {
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(iso) {
        if (!iso) return '';
        // Aceptamos tanto 'YYYY-MM-DD' como ISO timestamp.
        const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatMoneyForPrint(n) {
        const num = Number(n);
        if (!isFinite(num)) return '-';
        return num.toLocaleString('es-PY', { maximumFractionDigits: 0 });
    }

    /**
     * Genera un cronograma de cuotas listo para imprimir / guardar como PDF.
     *
     * @param {Object} opts
     * @param {Object} opts.enterprise   - { name, logo_url, address?, phone?, ruc? }
     * @param {Object} opts.customer     - { first_name, last_name, document_number, phone?, email? }
     * @param {Object} opts.sale         - { sale_number, sale_date, total_price, down_payment?, vehicle_info? }
     * @param {Array}  opts.quotas       - lista de cuotas { quota_number, amount, due_date, status, payment_date?, payment_method? }
     */
    function printQuotaSchedule({ enterprise, customer, sale, quotas }) {
        // Totales que mostramos en el pie del PDF.
        const totalPlan = quotas.reduce((acc, q) => acc + Number(q.amount || 0), 0);
        const totalPagado = quotas
            .filter(q => q.status === 'paid')
            .reduce((acc, q) => acc + Number(q.amount || 0), 0);
        const totalPendiente = totalPlan - totalPagado;
        const today = new Date().toLocaleDateString('es-PY');

        function statusLabel(q) {
            // Las cuotas con due_date < hoy y status != paid se muestran como
            // VENCIDA (matchea la lógica del modelo Quotum.effective_status).
            if (q.status === 'paid') return 'Pagada';
            if (q.status === 'cancelled') return 'Cancelada';
            const due = q.due_date ? new Date(q.due_date + 'T00:00:00') : null;
            const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
            if (due && due < todayD) return 'VENCIDA';
            return 'Pendiente';
        }

        function statusColor(label) {
            if (label === 'Pagada')    return '#15803d';
            if (label === 'VENCIDA')   return '#b91c1c';
            if (label === 'Cancelada') return '#6b7280';
            return '#1f2937';
        }

        const logoSrc = enterprise?.logo_url || '/assets/logo.jpg';
        const enterpriseName = escapeHtml(enterprise?.name || 'AUTO OFERTAS');
        const customerFullName = escapeHtml(
            `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || '—'
        );

        // CSS optimizado para A4. `@page` controla márgenes en print.
        // El truco del color: ponemos `print-color-adjust: exact` para que
        // los headers grises NO se impriman blancos (Chrome respeta esto).
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Cronograma — Venta ${escapeHtml(sale?.sale_number || '')}</title>
<style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    html, body {
        font-family: -apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
        color: #1f2937;
        margin: 0; padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    body { max-width: 800px; margin: 0 auto; padding: 14px; }

    /* Header con logo + nombre de empresa */
    .hdr { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-bottom: 14px; }
    .hdr img { height: 56px; width: 56px; object-fit: contain; }
    .hdr h1 { font-size: 22px; color: #dc2626; margin: 0; }
    .hdr .meta { font-size: 11px; color: #6b7280; margin-top: 4px; }

    /* Bloque de datos del cliente / venta */
    .info { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    .info section { border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px 12px; }
    .info h2 { font-size: 13px; margin: 0 0 6px 0; color: #374151; }
    .info dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-size: 11px; }
    .info dt { color: #6b7280; }
    .info dd { margin: 0; }

    /* Tabla de cuotas */
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead { background: #f3f4f6; }
    thead th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #d1d5db; font-weight: 600; }
    tbody td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    .num    { text-align: right; font-variant-numeric: tabular-nums; }
    .center { text-align: center; }
    .status { font-weight: 600; }

    /* Totales */
    .totals { margin-top: 10px; display: flex; justify-content: flex-end; gap: 16px; font-size: 12px; }
    .totals .item { text-align: right; }
    .totals .item .lbl { color: #6b7280; font-size: 10px; text-transform: uppercase; }
    .totals .item .val { font-weight: 600; font-size: 14px; }
    .totals .pag { color: #15803d; }
    .totals .pen { color: #b91c1c; }

    /* Pie */
    .foot { margin-top: 22px; font-size: 10px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    .foot .firma { margin-top: 22px; display: flex; justify-content: space-around; }
    .foot .firma div { border-top: 1px solid #6b7280; width: 200px; padding-top: 4px; }

    /* Botón de imprimir — visible en pantalla, oculto al imprimir */
    .toolbar {
        position: sticky; top: 0; background: #fef2f2; padding: 8px 14px; margin: -14px -14px 14px;
        border-bottom: 1px solid #fecaca; display: flex; gap: 8px; justify-content: flex-end;
    }
    .toolbar button {
        background: #dc2626; color: white; border: 0; padding: 6px 14px; border-radius: 4px;
        cursor: pointer; font-size: 12px; font-weight: 600;
    }
    .toolbar button.close { background: #6b7280; }
    @media print { .toolbar { display: none; } body { max-width: none; padding: 0; } }
</style>
</head>
<body>

<div class="toolbar">
    <button onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
    <button class="close" onclick="window.close()">Cerrar</button>
</div>

<div class="hdr">
    <img src="${escapeHtml(logoSrc)}" alt="Logo" onerror="this.style.display='none'">
    <div>
        <h1>${enterpriseName}</h1>
        <div class="meta">Cronograma de cuotas — generado el ${escapeHtml(today)}</div>
    </div>
</div>

<div class="info">
    <section>
        <h2>Cliente</h2>
        <dl>
            <dt>Nombre</dt><dd>${customerFullName}</dd>
            <dt>Documento</dt><dd>${escapeHtml(customer?.document_number || '—')}</dd>
            <dt>Teléfono</dt><dd>${escapeHtml(customer?.phone || '—')}</dd>
            <dt>Email</dt><dd>${escapeHtml(customer?.email || '—')}</dd>
        </dl>
    </section>
    <section>
        <h2>Venta</h2>
        <dl>
            <dt>N° venta</dt><dd>${escapeHtml(sale?.sale_number || '—')}</dd>
            <dt>Fecha</dt><dd>${escapeHtml(formatDate(sale?.sale_date))}</dd>
            <dt>Vehículo</dt><dd>${escapeHtml(sale?.vehicle_info || '—')}</dd>
            <dt>Precio total</dt><dd>Gs. ${formatMoneyForPrint(sale?.total_price)}</dd>
            ${sale?.down_payment ? `<dt>Seña</dt><dd>Gs. ${formatMoneyForPrint(sale.down_payment)}</dd>` : ''}
        </dl>
    </section>
</div>

<table>
    <thead>
        <tr>
            <th class="center">#</th>
            <th>Vencimiento</th>
            <th class="num">Importe (Gs.)</th>
            <th>Estado</th>
            <th>Fecha de pago</th>
            <th>Forma de pago</th>
        </tr>
    </thead>
    <tbody>
        ${quotas.map(q => {
            const lbl = statusLabel(q);
            const col = statusColor(lbl);
            return `<tr>
                <td class="center">${escapeHtml(q.quota_number)}</td>
                <td>${escapeHtml(formatDate(q.due_date))}</td>
                <td class="num">${formatMoneyForPrint(q.amount)}</td>
                <td class="status" style="color:${col}">${lbl}</td>
                <td>${escapeHtml(formatDate(q.payment_date))}</td>
                <td>${escapeHtml(q.payment_method_display || q.payment_method || '—')}</td>
            </tr>`;
        }).join('')}
    </tbody>
</table>

<div class="totals">
    <div class="item">
        <div class="lbl">Total del plan</div>
        <div class="val">Gs. ${formatMoneyForPrint(totalPlan)}</div>
    </div>
    <div class="item pag">
        <div class="lbl">Cobrado</div>
        <div class="val">Gs. ${formatMoneyForPrint(totalPagado)}</div>
    </div>
    <div class="item pen">
        <div class="lbl">Pendiente</div>
        <div class="val">Gs. ${formatMoneyForPrint(totalPendiente)}</div>
    </div>
</div>

<div class="foot">
    Este documento es un detalle informativo del plan de cuotas pactado.
    Cualquier diferencia será resuelta con los registros del sistema.
    <div class="firma">
        <div>Firma del cliente</div>
        <div>Firma del vendedor</div>
    </div>
</div>

<script>
    // Auto-trigger del diálogo de impresión cuando la página termina de
    // cargar. El usuario igual puede cancelar y volver a tocar el botón.
    window.addEventListener('load', () => {
        // 200ms de delay para asegurarnos de que el logo (img remota)
        // tuvo tiempo de cargar; si falla, onerror lo oculta y el
        // print sigue limpio.
        setTimeout(() => { try { window.print(); } catch (_) {} }, 300);
    });
</script>
</body>
</html>`;

        // Algunos browsers bloquean window.open si no es directamente desde
        // un evento de click. La función debe llamarse desde un onClick.
        const w = window.open('', '_blank');
        if (!w) {
            alert('El navegador bloqueó la ventana de impresión. Permití pop-ups para este sitio y volvé a intentar.');
            return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
    }

    window.printQuotaSchedule = printQuotaSchedule;

    /**
     * Dossier PDF del cliente — TODO el historial en una sola hoja.
     *
     * Layout:
     *   Header con logo + nombre empresa + fecha de generación.
     *   Datos del cliente (nombre, doc, contacto, dirección, notas).
     *   Resumen financiero (4 KPI tiles).
     *   Tabla de ventas.
     *   Por cada venta con cuotas: mini-tabla con sus cuotas.
     *
     * Se diseñó para imprimirse en 1-2 páginas A4. Las notas internas
     * NO se imprimen aunque estén en el modelo — son visibles solo en
     * la app para no quedar en papel firmado.
     */
    function printCustomerDossier({ enterprise, customer, sales, quotas, summary }) {
        const today = new Date().toLocaleDateString('es-PY');
        const logoSrc = enterprise?.logo_url || '/assets/logo.jpg';
        const enterpriseName = escapeHtml(enterprise?.name || 'AUTO OFERTAS');
        const customerFullName = escapeHtml(
            `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || '—'
        );

        // Agrupamos cuotas por sale_number para la sección "Cuotas".
        // Usamos un Map para preservar orden de inserción.
        const quotasBySale = new Map();
        (quotas || []).forEach(q => {
            const key = q.sale_number || '—';
            if (!quotasBySale.has(key)) quotasBySale.set(key, []);
            quotasBySale.get(key).push(q);
        });

        function saleStatusLabel(s) {
            return s.collection_status_display || s.collection_status || s.status_display || '';
        }

        const salesRows = (sales || []).map(s => `
            <tr>
                <td class="mono">${escapeHtml(s.sale_number || '')}</td>
                <td>${escapeHtml(formatDate(s.sale_date))}</td>
                <td>${escapeHtml(s.vehicle_info || '')}</td>
                <td class="num">${formatMoneyForPrint(s.total_price)}</td>
                <td>${escapeHtml(s.payment_form_name || '')}</td>
                <td>${escapeHtml(saleStatusLabel(s))}</td>
            </tr>
        `).join('');

        function quotaStatusLabel(q) {
            if (q.status === 'paid') return 'Pagada';
            if (q.status === 'cancelled') return 'Cancelada';
            const due = q.due_date ? new Date(q.due_date + 'T00:00:00') : null;
            const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
            if (due && due < todayD) return 'VENCIDA';
            return 'Pendiente';
        }
        function quotaStatusColor(label) {
            return label === 'Pagada'    ? '#15803d'
                 : label === 'VENCIDA'   ? '#b91c1c'
                 : label === 'Cancelada' ? '#6b7280'
                 : '#1f2937';
        }

        const quotaSections = Array.from(quotasBySale.entries()).map(([saleNum, qs]) => {
            const totalPlan = qs.reduce((acc, q) => acc + Number(q.amount || 0), 0);
            const pagado = qs.filter(q => q.status === 'paid')
                .reduce((acc, q) => acc + Number(q.amount || 0), 0);
            const rows = qs.map(q => {
                const lbl = quotaStatusLabel(q);
                return `<tr>
                    <td class="center">${escapeHtml(q.quota_number)}</td>
                    <td>${escapeHtml(formatDate(q.due_date))}</td>
                    <td class="num">${formatMoneyForPrint(q.amount)}</td>
                    <td style="color:${quotaStatusColor(lbl)}; font-weight:600">${lbl}</td>
                    <td>${escapeHtml(formatDate(q.payment_date))}</td>
                </tr>`;
            }).join('');
            return `
                <div class="quota-section">
                    <div class="quota-header">
                        <span class="mono">${escapeHtml(saleNum)}</span>
                        <span class="muted">
                            ${qs.filter(q => q.status === 'paid').length}/${qs.length} cobradas ·
                            Gs. ${formatMoneyForPrint(pagado)} / ${formatMoneyForPrint(totalPlan)}
                        </span>
                    </div>
                    <table class="mini">
                        <thead><tr>
                            <th class="center">#</th><th>Vence</th>
                            <th class="num">Monto</th><th>Estado</th><th>Pago</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Dossier — ${customerFullName}</title>
<style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
        font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
        font-size: 11px; color: #1f2937; margin: 0; padding: 12px;
        max-width: 800px; margin: 0 auto;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .hdr { display: flex; align-items: center; gap: 12px;
        border-bottom: 2px solid #dc2626; padding-bottom: 8px; margin-bottom: 10px; }
    .hdr img { height: 48px; width: 48px; object-fit: contain; }
    .hdr h1 { font-size: 20px; color: #dc2626; margin: 0; }
    .hdr .meta { font-size: 10px; color: #6b7280; }

    .customer { border: 1px solid #e5e7eb; border-radius: 4px;
        padding: 8px 10px; margin-bottom: 10px; }
    .customer h2 { font-size: 13px; margin: 0 0 4px; color: #374151; }
    .customer dl { margin: 0; display: grid;
        grid-template-columns: auto 1fr auto 1fr; gap: 2px 8px; font-size: 11px; }
    .customer dt { color: #6b7280; }
    .customer dd { margin: 0; }

    .kpis { display: grid; grid-template-columns: repeat(4, 1fr);
        gap: 8px; margin-bottom: 10px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 4px; padding: 6px 8px; }
    .kpi .lbl { font-size: 9px; color: #6b7280; text-transform: uppercase; }
    .kpi .val { font-size: 14px; font-weight: 600; margin-top: 2px; }
    .kpi.green .val   { color: #15803d; }
    .kpi.yellow .val  { color: #b45309; }
    .kpi.red .val     { color: #b91c1c; }

    h3 { font-size: 12px; margin: 14px 0 4px; color: #374151;
        border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; }

    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 4px; }
    thead { background: #f3f4f6; }
    th, td { padding: 3px 6px; border-bottom: 1px solid #e5e7eb; text-align: left; }
    .num    { text-align: right; font-variant-numeric: tabular-nums; }
    .center { text-align: center; }
    .mono   { font-family: ui-monospace, "SF Mono", monospace; }
    .muted  { color: #6b7280; font-size: 10px; }

    .quota-section { margin: 8px 0; page-break-inside: avoid; }
    .quota-header  { display: flex; justify-content: space-between;
        align-items: baseline; margin-bottom: 2px; font-size: 11px; }
    .mini th { background: #fafafa; font-size: 9px; }

    .foot { margin-top: 12px; font-size: 9px; color: #6b7280;
        text-align: center; border-top: 1px solid #e5e7eb; padding-top: 6px; }

    .toolbar { position: sticky; top: 0; background: #fef2f2;
        padding: 6px 12px; margin: -12px -12px 10px;
        border-bottom: 1px solid #fecaca; display: flex; gap: 6px;
        justify-content: flex-end; }
    .toolbar button { background: #dc2626; color: white; border: 0;
        padding: 4px 12px; border-radius: 4px; cursor: pointer;
        font-size: 11px; font-weight: 600; }
    .toolbar button.close { background: #6b7280; }
    @media print { .toolbar { display: none; } body { max-width: none; padding: 0; } }
</style></head><body>

<div class="toolbar">
    <button onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
    <button class="close" onclick="window.close()">Cerrar</button>
</div>

<div class="hdr">
    <img src="${escapeHtml(logoSrc)}" alt="Logo" onerror="this.style.display='none'">
    <div>
        <h1>${enterpriseName}</h1>
        <div class="meta">Dossier de cliente — generado el ${escapeHtml(today)}</div>
    </div>
</div>

<div class="customer">
    <h2>${customerFullName}</h2>
    <dl>
        <dt>Documento</dt><dd>${escapeHtml(customer?.document_number || '—')}</dd>
        <dt>Tipo</dt><dd>${escapeHtml(customer?.document_type_display || customer?.document_type || '—')}</dd>
        <dt>Teléfono</dt><dd>${escapeHtml(customer?.phone || '—')}</dd>
        <dt>Email</dt><dd>${escapeHtml(customer?.email || '—')}</dd>
        <dt>Ciudad</dt><dd>${escapeHtml(customer?.city || '—')}</dd>
        <dt>Dirección</dt><dd>${escapeHtml(customer?.address || '—')}</dd>
    </dl>
</div>

<div class="kpis">
    <div class="kpi"><div class="lbl">Comprado</div><div class="val">Gs. ${formatMoneyForPrint(summary?.tot_comprado)}</div><div class="muted">${summary?.n_ventas || 0} venta(s)</div></div>
    <div class="kpi green"><div class="lbl">Cobrado</div><div class="val">Gs. ${formatMoneyForPrint(summary?.tot_cobrado)}</div><div class="muted">${summary?.n_pagadas || 0} cuota(s)</div></div>
    <div class="kpi yellow"><div class="lbl">Pendiente</div><div class="val">Gs. ${formatMoneyForPrint(summary?.tot_pendiente)}</div><div class="muted">${summary?.n_pendientes || 0} al día</div></div>
    <div class="kpi red"><div class="lbl">Vencido</div><div class="val">Gs. ${formatMoneyForPrint(summary?.tot_vencido)}</div><div class="muted">${summary?.n_vencidas || 0} vencidas</div></div>
</div>

${sales && sales.length > 0 ? `
<h3>Ventas (${sales.length})</h3>
<table>
    <thead><tr>
        <th>N° venta</th><th>Fecha</th><th>Vehículo</th>
        <th class="num">Total</th><th>Pago</th><th>Cobranza</th>
    </tr></thead>
    <tbody>${salesRows}</tbody>
</table>
` : ''}

${quotaSections ? `<h3>Cuotas por venta</h3>${quotaSections}` : ''}

<div class="foot">
    Documento informativo. Cualquier diferencia será resuelta con los
    registros del sistema.
</div>

<script>
    window.addEventListener('load', () => {
        setTimeout(() => { try { window.print(); } catch (_) {} }, 300);
    });
</script>
</body></html>`;

        const w = window.open('', '_blank');
        if (!w) {
            alert('El navegador bloqueó la ventana de impresión. Permití pop-ups y volvé a intentar.');
            return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
    }

    window.printCustomerDossier = printCustomerDossier;
})();
