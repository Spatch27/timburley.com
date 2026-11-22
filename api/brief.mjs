// Vercel Serverless Function — POST /api/brief
// Zero-dependency Resend integration using Node.js native fetch + Web Standard API.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, maxLen = 2000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildRows(d) {
  const rows = [
    ['Commissioning route', d.route || 'Not specified'],
    ['Name', d.name],
    ['Organisation / agency', d.organisation || 'Not specified'],
    ['Email', d.email],
    ['What we are naming', d.namingType || 'Not specified'],
    ['Brief summary', d.summary],
    ['What already exists / dependencies', d.dependencies || 'Not specified'],
    ['Timeline & hard milestones', d.timeline || 'Not specified'],
    ['Indicative budget', d.budget || 'Not specified'],
    ['Deciding group & sign-off', d.deciders || 'Not specified'],
    ['Trademark scope & legal partner', d.trademark || 'Not specified']
  ];

  if (d.pitfalls) rows.push(['Flagged pitfalls', d.pitfalls]);
  if (d.refProject) rows.push(['Referenced project', d.refProject]);
  return rows;
}

function renderPlainText(d, rows) {
  const lines = [
    'NEW NAMING BRIEF — timburley.com',
    '========================================',
    ''
  ];
  for (const [label, val] of rows) {
    lines.push(`${label.toUpperCase()}:`);
    lines.push(val);
    lines.push('');
  }
  return lines.join('\n');
}

function renderHtml(d, rows, introText) {
  const rowHtml = rows
    .map(
      ([label, val]) => `
        <tr>
          <td style="padding:12px 16px 12px 0; border-bottom:1px solid #e5e2d9; vertical-align:top; width:210px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#6b6a65;">
            ${escapeHtml(label)}
          </td>
          <td style="padding:12px 0; border-bottom:1px solid #e5e2d9; vertical-align:top; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:15px; line-height:1.6; color:#111110; white-space:pre-line;">
            ${escapeHtml(val)}
          </td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en-GB">
<body style="margin:0; padding:32px 16px; background:#F6F5F0; color:#111110;">
  <div style="max-width:640px; margin:0 auto; background:#FFFFFF; border:1px solid #DDDAD0; padding:32px;">
    <p style="margin:0 0 6px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#C93B2B;">
      Tim Burley · Creating great names
    </p>
    <h1 style="margin:0 0 12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:24px; font-weight:600; letter-spacing:-0.02em; color:#111110;">
      Naming Brief — ${escapeHtml(d.organisation || d.name)}
    </h1>
    <p style="margin:0 0 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:14px; line-height:1.55; color:#5A5954;">
      ${escapeHtml(introText)}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:2px solid #111110; border-collapse:collapse;">
      ${rowHtml}
    </table>
  </div>
</body>
</html>`;
}

async function sendViaResend(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Resend HTTP ${res.status}: ${errText}`);
  }
  return res.json();
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
    }

    // Silent honeypot check for spam bots
    if (clean(body?.website, 200)) {
      return Response.json({ ok: true }, { status: 200 });
    }

    const data = {
      route: clean(body?.route, 80),
      name: clean(body?.name, 140),
      organisation: clean(body?.organisation, 180),
      email: clean(body?.email, 200),
      namingType: clean(body?.namingType, 120),
      summary: clean(body?.summary, 4000),
      dependencies: clean(body?.dependencies, 2500),
      timeline: clean(body?.timeline, 400),
      budget: clean(body?.budget, 120),
      deciders: clean(body?.deciders, 400),
      trademark: clean(body?.trademark, 400),
      pitfalls: clean(body?.pitfalls, 600),
      refProject: clean(body?.refProject, 200),
      sendCopy: Boolean(body?.sendCopy)
    };

    if (!data.name) {
      return Response.json({ ok: false, error: 'Please include your name.' }, { status: 400 });
    }
    if (!data.email || !EMAIL_RE.test(data.email)) {
      return Response.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (!data.summary) {
      return Response.json(
        { ok: false, error: 'Please add a short paragraph summarising the brief.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[api/brief] RESEND_API_KEY is not configured in Vercel environment variables.');
      return Response.json(
        {
          ok: false,
          code: 'NOT_CONFIGURED',
          error: 'Direct email delivery is being finalised. You can copy your brief or email names@timburley.com directly.'
        },
        { status: 503 }
      );
    }

    const fromEmail = process.env.BRIEF_FROM_EMAIL || 'Tim Burley <names@timburley.com>';
    const toEmail = process.env.BRIEF_TO_EMAIL || 'names@timburley.com';
    const rows = buildRows(data);
    const subjectSuffix = data.namingType ? ` (${data.namingType})` : '';
    const subject = `Naming brief — ${data.organisation || data.name}${subjectSuffix}`;

    const sent = await sendViaResend(apiKey, {
      from: fromEmail,
      to: [toEmail],
      reply_to: data.email,
      subject,
      text: renderPlainText(data, rows),
      html: renderHtml(data, rows, 'Hit Reply to respond directly to the sender.')
    });

    // Optional copy to sender (isolated so any issue doesn't fail the primary delivery)
    if (data.sendCopy) {
      try {
        await sendViaResend(apiKey, {
          from: fromEmail,
          to: [data.email],
          reply_to: toEmail,
          subject: `Copy of your naming brief — Tim Burley`,
          text: `Thanks ${data.name} — I have received your naming brief and will come back to you shortly.\n\n${renderPlainText(data, rows)}`,
          html: renderHtml(
            data,
            rows,
            `Thanks ${data.name} — I’ve received your naming brief and will come back to you personally, usually within one working day.`
          )
        });
      } catch (copyErr) {
        console.error('[api/brief] Optional sender copy failed:', copyErr);
      }
    }

    return Response.json({ ok: true, id: sent?.id || null }, { status: 200 });
  } catch (err) {
    console.error('[api/brief] Unexpected failure:', err);
    return Response.json(
      {
        ok: false,
        error: 'Something went wrong sending your brief. Please try again or email names@timburley.com directly.'
      },
      { status: 500 }
    );
  }
}
