/**
 * Branded HTML email templates for Supermom notifications.
 * Aesthetic matches api/invoice.ts (Supermom pink #FC4693, Inter/Arial font, clean card).
 */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds branded HTML email for request notifications (done / reply).
 *
 * @param {object} params
 * @param {string} [params.kind] - 'bug' | 'idea'
 * @param {string} params.title - Request title
 * @param {string} [params.body] - Reply body from Joel
 * @param {'done' | 'reply'} params.variant - 'done' or 'reply'
 * @param {string} [params.recipientName] - Optional submitter first name
 * @returns {string} HTML string
 */
export function buildRequestEmailHtml({ kind, title, body, variant, recipientName }) {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeName = escapeHtml(recipientName || 'there');

  const isDone = variant === 'done';
  const headerLabel = isDone ? 'FIXED' : 'UPDATE';
  const heading = isDone ? 'Your bug report / idea is fixed' : 'Joel replied to your request';
  const pink = '#FC4693';
  const cream = '#FFF9F5';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td style="background:${pink};padding:28px 32px;text-align:center;">
          <img src="https://supermom-v2.vercel.app/branding/logo-final-white-bg.png" alt="Supermom" height="80" style="display:block;margin:0 auto 12px;border-radius:8px;" />
          <div style="color:white;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.95;">${headerLabel}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">Hi ${safeName},</p>
          <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1a1a1a;line-height:1.3;">${heading}</h2>

          <!-- Request Title Callout -->
          <div style="background:${cream};border:1.5px solid #FFD6E8;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
            <div style="font-size:10px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Request</div>
            <div style="font-size:16px;font-weight:600;color:#1a1a1a;">${safeTitle}</div>
          </div>

          ${safeBody ? `
          <!-- Joel's message -->
          <div style="margin-bottom:24px;">
            <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Joel's Reply</div>
            <div style="background:#fafafa;border-left:3px solid ${pink};padding:14px 16px;border-radius:0 8px 8px 0;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap;">${safeBody}</div>
          </div>
          ` : ''}

          <!-- App reference -->
          <div style="border-top:1px solid #eee;padding-top:20px;margin-top:24px;">
            <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">
              You can check this anytime under <strong>My requests</strong> in the Supermom app.${isDone ? ' If this still isn\'t working or you need a follow-up, simply reply from the app to reopen it.' : ''}
            </p>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#fafafa;border-top:1px solid #eee;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaa;">Supermom for Hire · Georgetown, ON</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
