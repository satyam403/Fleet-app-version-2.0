// ════════════════════════════════════════════════════════════════════════
//  Inventory report → email (EmailJS, fully client-side)
//
//  Sends the Inventory Update report to satyam@handatransportation.com.
//  The email body carries a full HTML summary of every change (works on the
//  EmailJS free tier), and — if your EmailJS template defines a Variable
//  Attachment — the generated PDF rides along as `content` / `filename`.
//
//  ─── ONE-TIME SETUP (emailjs.com, free) ────────────────────────────────
//  1. Create an Email Service → copy its Service ID.
//  2. Create an Email Template. In the template body use these variables:
//        To:      {{to_email}}
//        Subject: {{subject}}
//        Body:    {{message}}            ← plain-text fallback
//                 {{{report_html}}}      ← triple braces = rendered HTML table
//        From name: {{from_name}}
//     (Optional, paid plans) add an Attachment → type "Variable Attachment",
//      content = {{content}}, filename = {{filename}}.
//  3. Copy the Template ID and your Public Key (Account → API Keys).
//  4. Put them in .env.local:
//        VITE_EMAILJS_SERVICE_ID=service_xxx
//        VITE_EMAILJS_TEMPLATE_ID=template_xxx
//        VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxx
// ════════════════════════════════════════════════════════════════════════

import emailjs from '@emailjs/browser';
import {
  generateInventoryUpdatesPdfBlob,
  blobToBase64,
  type InventoryUpdateLogRow,
} from './pdf';

export const INVENTORY_REPORT_RECIPIENT = 'satyam@handatransportation.com';

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

export function isEmailConfigured(): boolean {
  return Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDateTime(s: string): string {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Builds an HTML table + plain-text summary of the update log for the body. */
function buildSummary(logs: InventoryUpdateLogRow[]) {
  const adds = logs.filter(l => l.action === 'add').length;
  const updates = logs.length - adds;
  const unitsAdded = logs.reduce((s, l) => s + Math.max(l.change, 0), 0);
  const unitsRemoved = logs.reduce((s, l) => s + Math.max(-l.change, 0), 0);

  const sorted = logs.slice().sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
  );

  const rows = sorted.map(l => {
    const chg = (l.change >= 0 ? '+' : '') + l.change;
    const chgColor = l.change > 0 ? '#15803d' : l.change < 0 ? '#b91c1c' : '#64748b';
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;font-family:monospace;font-size:12px;">${esc(fmtDateTime(l.updatedAt))}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;font-weight:600;">${esc(l.partName || '—')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;font-family:monospace;font-size:12px;">${esc(l.partNumber || '—')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;">${l.action === 'add' ? 'Added' : 'Update'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;text-align:right;">${l.previousQty}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;text-align:right;font-weight:700;">${l.newQty}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;text-align:right;color:${chgColor};font-weight:700;">${chg}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;font-weight:600;">${esc(l.updatedBy || '—')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eef2f7;color:#64748b;">${esc(l.note || '')}</td>
    </tr>`;
  }).join('');

  const report_html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <p style="margin:0 0 10px;">
        <strong>Total changes:</strong> ${logs.length} &nbsp;·&nbsp;
        <strong>New parts:</strong> ${adds} &nbsp;·&nbsp;
        <strong>Quantity updates:</strong> ${updates} &nbsp;·&nbsp;
        <strong>Units:</strong> <span style="color:#15803d;">+${unitsAdded}</span> / <span style="color:#b91c1c;">-${unitsRemoved}</span>
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead>
          <tr style="background:#1e40af;color:#fff;text-align:left;">
            <th style="padding:8px;">Date / Time</th>
            <th style="padding:8px;">Part Name</th>
            <th style="padding:8px;">Part #</th>
            <th style="padding:8px;">Action</th>
            <th style="padding:8px;text-align:right;">Prev</th>
            <th style="padding:8px;text-align:right;">New</th>
            <th style="padding:8px;text-align:right;">Change</th>
            <th style="padding:8px;">By</th>
            <th style="padding:8px;">Note</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="9" style="padding:12px;text-align:center;color:#64748b;">No updates in this period.</td></tr>'}</tbody>
      </table>
    </div>`;

  const message = sorted.map(l =>
    `${fmtDateTime(l.updatedAt)} | ${l.partName} (${l.partNumber || '—'}) | ${l.action === 'add' ? 'Added' : 'Update'} | ${l.previousQty} → ${l.newQty} (${l.change >= 0 ? '+' : ''}${l.change}) | by ${l.updatedBy || '—'}${l.note ? ` | ${l.note}` : ''}`,
  ).join('\n') || 'No inventory updates in this period.';

  return { report_html, message };
}

/**
 * Generates the PDF and emails the full report to satyam@handatransportation.com.
 * Throws if EmailJS isn't configured or the send fails (caller shows a toast).
 */
export async function sendInventoryReportEmail(
  logs: InventoryUpdateLogRow[],
  period: string,
  userName?: string,
): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error(
      'EmailJS not configured. Add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID and VITE_EMAILJS_PUBLIC_KEY to .env.local.',
    );
  }

  const blob = await generateInventoryUpdatesPdfBlob(logs, period, userName);
  const base64 = await blobToBase64(blob);
  const { report_html, message } = buildSummary(logs);

  const filename = `inventory-update-report-${period.replace(/[^\w]+/g, '-').toLowerCase()}.pdf`;

  await emailjs.send(
    SERVICE_ID!,
    TEMPLATE_ID!,
    {
      to_email:     INVENTORY_REPORT_RECIPIENT,
      from_name:    userName || 'FleetOps',
      subject:      `Inventory Update Report — ${period}`,
      period,
      generated_at: new Date().toLocaleString('en-US'),
      total_changes: String(logs.length),
      message,
      report_html,
      // Variable Attachment params (used only if the template defines one):
      content:  base64,
      filename,
    },
    { publicKey: PUBLIC_KEY! },
  );
}
