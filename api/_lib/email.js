// Sends a PURE-branded order confirmation email via Resend. Silently does
// nothing if RESEND_API_KEY isn't set or there's no guest email to send to —
// same graceful-fallback pattern as Slack, never throws (a failed email
// shouldn't fail the Stripe webhook response).

import { Resend } from 'resend';

const INK = '#0A0A0A';
const GREEN = '#6FB054';

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

const money = (pence) => `£${(Number(pence) / 100).toFixed(2)}`;

function renderReceiptHtml(order) {
  const rows = (order.items || []).map((item) => {
    const unit = item.qty ? Math.round(item.amount / item.qty) : item.amount;
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${INK};">
          ${escapeHtml(item.name)}
          <div style="font-size:11px;color:#999999;margin-top:2px;">${item.qty} × ${money(unit)}</div>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${INK};text-align:right;vertical-align:top;">
          ${money(item.amount)}
        </td>
      </tr>
    `;
  }).join('');

  return `
<div style="background:#f2f4f5;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:2px solid ${INK};">
    <div style="background:${INK};padding:28px 24px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:28px;letter-spacing:-0.02em;color:#ffffff;">PURE</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.15em;color:${GREEN};margin-top:4px;">ALL NATURAL</div>
    </div>
    <div style="padding:28px 24px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:${INK};margin-bottom:6px;">Thanks for your order!</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;line-height:1.6;margin-bottom:24px;">
        We're getting it ready — it'll be delivered straight to your cabin.
      </div>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.05em;color:#777777;padding:3px 0;">ORDER</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${INK};text-align:right;font-weight:700;padding:3px 0;">#${escapeHtml(order.orderNumber)}</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.05em;color:#777777;padding:3px 0;">CABIN</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${INK};text-align:right;font-weight:700;padding:3px 0;">${escapeHtml(order.cabinName || '—')}</td>
        </tr>
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.05em;color:#777777;padding:3px 0;">DELIVERY WINDOW</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${INK};text-align:right;font-weight:700;padding:3px 0;">${escapeHtml(order.deliverySlot || '—')}</td>
        </tr>
      </table>
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        ${rows}
        <tr>
          <td style="padding-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${INK};">TOTAL</td>
          <td style="padding-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${INK};text-align:right;">${money(order.amountTotal)}</td>
        </tr>
      </table>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;margin-top:28px;line-height:1.5;">
        Questions about your order? Just reply to this email.
      </div>
    </div>
  </div>
</div>
  `;
}

export async function sendOrderConfirmationEmail(order, toEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !toEmail) return;

  const from = process.env.EMAIL_FROM || 'PURE <onboarding@resend.dev>';
  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from,
      to: toEmail,
      replyTo: process.env.EMAIL_REPLY_TO || undefined,
      subject: `Your PURE order #${order.orderNumber} is confirmed`,
      html: renderReceiptHtml(order),
    });
  } catch (err) {
    console.error('Order confirmation email failed', err);
  }
}
