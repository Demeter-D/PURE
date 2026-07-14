// Posts a new-order notification to Slack via an Incoming Webhook. Silently
// does nothing if SLACK_WEBHOOK_URL isn't set, and never throws — a Slack
// hiccup shouldn't fail the Stripe webhook response.

export async function notifySlack(order) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  const itemLines = order.items.length
    ? order.items.map((i) => `• ${i.qty} × ${i.name}`).join('\n')
    : '(no line item details)';

  const text = [
    `*New order #${order.orderNumber}* — CABIN ${order.cabinName || '—'} · ${order.deliverySlot || '—'}`,
    itemLines,
    `Total: £${(order.amountTotal / 100).toFixed(2)}`,
  ].join('\n');

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error('Slack notification failed', err);
  }
}
