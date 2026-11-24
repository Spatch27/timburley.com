#!/usr/bin/env node
/* ==========================================================================
   timburley.com · SEO, Static Pre-Render & Agent Discovery Sync Script
   Reads public/assets/js/data.js as the single source of truth and updates:
     - Pre-rendered static HTML on /, /work, /process, and all 14 /work/<slug>
     - Canonicals, SEO titles/descriptions, Open Graph, Twitter Cards & JSON-LD
     - public/robots.txt & public/sitemap.xml
     - public/llms.txt & public/llms-full.txt
   Run whenever projects, testimonials, or pitfalls change:
     node scripts/sync-seo.mjs
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const SITE_URL = 'https://www.timburley.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/og-default.jpg`;
const ASSET_VERSION = '20261124g';
const LASTMOD = new Date().toISOString().slice(0, 10);

function loadData() {
  const code = fs.readFileSync(path.join(PUBLIC, 'assets/js/data.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  if (!sandbox.window.TB_DATA) {
    throw new Error('Could not load window.TB_DATA from public/assets/js/data.js');
  }
  return sandbox.window.TB_DATA;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTags(str) {
  return String(str ?? '').replace(/<[^>]+>/g, '');
}

function truncateDesc(str, max = 158) {
  const clean = stripTags(str).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 90 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\s]+$/, '')}.`;
}

function buildHead({
  title,
  description,
  canonicalPath,
  ogType = 'website',
  ogImage = DEFAULT_OG_IMAGE,
  ogImageAlt = 'Tim Burley: Brand Naming Consultant, UK. Creating great names.',
  noindex = false,
  jsonLd = null
}) {
  const canonicalUrl = canonicalPath !== null ? `${SITE_URL}${canonicalPath}` : null;
  const lines = [
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(title)}</title>`
  ];

  if (description) {
    lines.push(`  <meta name="description" content="${escapeHtml(description)}">`);
  }

  if (noindex) {
    lines.push('  <meta name="robots" content="noindex, follow">');
  } else if (canonicalUrl) {
    lines.push(`  <link rel="canonical" href="${canonicalUrl}">`);
    lines.push('  <link rel="alternate" type="text/plain" href="/llms.txt" title="Tim Burley LLM Summary">');
    lines.push('  <meta property="og:site_name" content="Tim Burley · Creating great names">');
    lines.push('  <meta property="og:locale" content="en_GB">');
    lines.push(`  <meta property="og:type" content="${ogType}">`);
    lines.push(`  <meta property="og:url" content="${canonicalUrl}">`);
    lines.push(`  <meta property="og:title" content="${escapeHtml(title)}">`);
    if (description) {
      lines.push(`  <meta property="og:description" content="${escapeHtml(description)}">`);
    }
    lines.push(`  <meta property="og:image" content="${ogImage}">`);
    if (ogImage === DEFAULT_OG_IMAGE) {
      lines.push('  <meta property="og:image:width" content="1200">');
      lines.push('  <meta property="og:image:height" content="630">');
    }
    lines.push(`  <meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}">`);
    lines.push('  <meta name="twitter:card" content="summary_large_image">');
    lines.push(`  <meta name="twitter:title" content="${escapeHtml(title)}">`);
    if (description) {
      lines.push(`  <meta name="twitter:description" content="${escapeHtml(description)}">`);
    }
    lines.push(`  <meta name="twitter:image" content="${ogImage}">`);
  }

  lines.push(
    `  <link rel="icon" href="/favicon.svg?v=${ASSET_VERSION}" type="image/svg+xml">`,
    '  <link rel="preconnect" href="https://fonts.googleapis.com">',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">',
    `  <link rel="stylesheet" href="/assets/css/styles.css?v=${ASSET_VERSION}">`
  );

  if (jsonLd) {
    const serialized = JSON.stringify(jsonLd, null, 2)
      .replace(/<\//g, '<\\/')
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    lines.push('  <script type="application/ld+json">');
    lines.push(serialized);
    lines.push('  </script>');
  }

  return `<head>\n${lines.join('\n')}\n</head>`;
}

function replaceHead(html, headBlock) {
  return html.replace(/<head>[\s\S]*?<\/head>/, headBlock);
}

function bumpAssetVersions(html) {
  return html.replace(/\?v=2026\d+[a-z]?/g, `?v=${ASSET_VERSION}`);
}

function replaceContainerById(html, id, innerHtml) {
  const startMark = `<!-- sync:${id}:start -->`;
  const endMark = `<!-- sync:${id}:end -->`;
  const markedRe = new RegExp(`${startMark}[\\s\\S]*?${endMark}`);
  if (markedRe.test(html)) {
    return html.replace(markedRe, `${startMark}\n${innerHtml}\n          ${endMark}`);
  }
  const emptyRe = new RegExp(`(<div[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(<\\/div>)`);
  if (!emptyRe.test(html)) {
    throw new Error(`Container #${id} not found`);
  }
  return html.replace(emptyRe, `$1\n          ${startMark}\n${innerHtml}\n          ${endMark}\n        $2`);
}

function renderSpecimenCardHtml(project, totalCount, showIndex = true) {
  const styleClass =
    project.style === 'sans'
      ? ' specimen-card__wordmark--sans'
      : project.style === 'italic'
      ? ' specimen-card__wordmark--italic'
      : '';
  const topLeftHtml = showIndex
    ? `\n            <span class="specimen-card__num">${project.num} / ${totalCount}</span>`
    : '';
  return `          <a href="/work/${project.id}" class="specimen-card" aria-label="Read the naming story for ${escapeHtml(project.name)}">
            <div class="specimen-card__top">${topLeftHtml}
              <span class="specimen-card__cat">${escapeHtml(project.category)}</span>
            </div>
            <div>
              <h3 class="specimen-card__wordmark${styleClass}">${escapeHtml(project.name)}</h3>
              <p class="specimen-card__sector">${escapeHtml(project.sector)}</p>
            </div>
            <div class="specimen-card__foot">
              <span>${escapeHtml(project.launchDate)}</span>
              <span>Read story →</span>
            </div>
          </a>`;
}

function renderTestimonialCardHtml(t, isFeatured = false) {
  const cls = isFeatured ? 'testimonial-card testimonial-card--featured' : 'testimonial-card';
  return `          <article class="${cls}">
            <div>
              <blockquote class="testimonial-card__quote">${t.quote}</blockquote>
            </div>
            <div class="testimonial-card__meta">
              <div>
                <div class="testimonial-card__author">${escapeHtml(t.author)}</div>
                <div class="testimonial-card__role">${escapeHtml(t.role)}</div>
              </div>
              <span class="testimonial-card__project">${escapeHtml(t.projectLabel)}</span>
            </div>
          </article>`;
}

function renderPitfallsHtml(pitfalls) {
  return pitfalls
    .map((item, index) => {
      const open = index === 0;
      return `          <article class="pitfall-item${open ? ' is-open' : ''}">
            <button type="button" class="pitfall-trigger" aria-expanded="${open ? 'true' : 'false'}">
              <span class="pitfall-trigger__num">${escapeHtml(item.num)}</span>
              <span>
                <span class="pitfall-trigger__title">${escapeHtml(item.title)}</span>
                <span class="pitfall-trigger__subtitle">${escapeHtml(item.subtitle)}</span>
              </span>
              <span class="pitfall-trigger__icon" aria-hidden="true">+</span>
            </button>
            <div class="pitfall-panel" aria-hidden="${open ? 'false' : 'true'}">
              <div class="pitfall-panel__inner">
                <p class="pitfall-quote">${item.heardInMeeting}</p>
                <div class="pitfall-panel__grid">
                  <div>
                    <h4>Why teams fall into it</h4>
                    <p>${item.whyItHappens}</p>
                  </div>
                  <div>
                    <h4>How the process prevents it</h4>
                    <p>${item.antidote}</p>
                  </div>
                </div>
                <button type="button" class="pitfall-flag-btn" data-pitfall-id="${escapeHtml(item.id)}" aria-pressed="false">
                  <span class="pitfall-flag-icon">○</span>
                  <span>We’ve seen this in our organisation</span>
                </button>
              </div>
            </div>
          </article>`;
    })
    .join('\n');
}

function renderCaseStudyMain(project, idx, projects, approvedTestimonials) {
  const prev = projects[(idx - 1 + projects.length) % projects.length];
  const next = projects[(idx + 1) % projects.length];

  const footRightHtml =
    project.imageCredit && project.caseStudyUrl
      ? `<span>Image © <a href="${project.caseStudyUrl}" target="_blank" rel="noopener noreferrer" class="text-link" style="font-family:var(--font-mono); font-size:0.72rem;">Believe in</a>, ${escapeHtml(project.launchDate)}</span>`
      : project.liveUrl
      ? `<span><a href="${project.liveUrl}" target="_blank" rel="noopener noreferrer" class="text-link" style="font-family:var(--font-mono); font-size:0.72rem;">${escapeHtml(project.liveUrlLabel || 'Visit live brand ↗')}</a></span>`
      : '';

  const domainHtml =
    project.liveUrl && !project.liveUrlLabel && project.domain && project.domain !== 'N/A'
      ? `<a href="${project.liveUrl}" target="_blank" rel="noopener noreferrer" class="text-link">${escapeHtml(project.domain)} ↗</a>`
      : escapeHtml(project.domain || 'N/A');

  const trademarkHtml = project.trademarkUrl
    ? `<a href="${project.trademarkUrl}" target="_blank" rel="noopener noreferrer" class="text-link">Registered ↗</a>`
    : 'Unregistered';

  const visualStageHtml = project.visualImage
    ? `        <figure class="case-visual-stage case-visual-stage--media" style="margin:0 0 2.5rem;">
          <img class="case-visual-stage__image" src="${project.visualImage}" alt="${escapeHtml(project.name)}: ${escapeHtml(project.visualCaption)}">
          <figcaption class="case-visual-stage__foot">
            <span>${escapeHtml(project.visualCaption)}</span>
            ${footRightHtml}
          </figcaption>
        </figure>\n`
    : '';

  const testimonial = project.testimonialId
    ? approvedTestimonials.find((t) => t.id === project.testimonialId) || null
    : null;

  const testimonialSectionHtml = testimonial
    ? `
    <section class="section section--stone">
      <div class="container container--narrow">
        <span class="eyebrow" style="display:block; margin-bottom:1.25rem;">Client &amp; Partner Perspective</span>
        <div id="case-testimonial-slot">
${renderTestimonialCardHtml(testimonial)}
        </div>
      </div>
    </section>`
    : '';

  return `<main id="main" data-case-study="${project.id}" data-prerendered="true">
    <section class="hero" style="padding-bottom:2.75rem;">
      <div class="container">
        <a href="/work" class="case-crumb">← All ${projects.length} named projects</a>
        <div class="case-header-row">
          <span class="eyebrow">${escapeHtml(project.num)} / ${projects.length} · ${escapeHtml(project.launchDate)} · ${escapeHtml(project.category)}</span>
        </div>
        <h1 class="h-display" style="margin-bottom:1.15rem;">${escapeHtml(project.name)}</h1>
        <p class="lead" style="margin:0;">${project.summary}</p>
      </div>
    </section>

    <section class="section section--flush-top" style="padding-top:0.5rem;">
      <div class="container">
${visualStageHtml}        <dl class="case-meta-ledger">
          <div>
            <dt>Brand name</dt>
            <dd>${escapeHtml(project.name)}</dd>
          </div>
          <div>
            <dt>Domain</dt>
            <dd>${domainHtml}</dd>
          </div>
          <div>
            <dt>Trademark</dt>
            <dd>${trademarkHtml}</dd>
          </div>
          <div>
            <dt>Agency</dt>
            <dd>${escapeHtml(project.agencyPartner || 'Direct')}</dd>
          </div>
          <div>
            <dt>Client</dt>
            <dd>${escapeHtml(project.client || 'N/A')}</dd>
          </div>
          <div>
            <dt>Launch date</dt>
            <dd>${escapeHtml(project.launchDate || 'TBC')}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="section section--flush-top" style="padding-top:2rem;">
      <div class="container">
        <div class="case-story-grid">
          <div class="case-story-aside">
            <h2 class="h-section">How <em>${escapeHtml(project.name)}</em> came to be.</h2>
          </div>

          <div>
            <div class="case-story-block">
              <span class="eyebrow">01 · The Brief</span>
              <h2>The challenge</h2>
              <p>${project.brief}</p>
            </div>

            <div class="case-story-block">
              <span class="eyebrow">02 · The Story</span>
              <h2>Inside the naming process</h2>
              <p>${project.story}</p>
            </div>

            <div class="case-story-block">
              <span class="eyebrow">03 · Process &amp; Decision</span>
              <h2>Steering alignment &amp; clearance</h2>
              <p>${project.processNote}</p>
            </div>

            <div class="case-story-block">
              <span class="eyebrow">04 · The Outcome</span>
              <h2>Why the name works</h2>
              <p>${project.outcome}</p>
            </div>

            <div class="case-story-cta">
              <a href="/brief?ref=${encodeURIComponent(project.name)}" class="btn btn--primary">Naming something similar? Start a brief →</a>
            </div>
          </div>
        </div>
      </div>
    </section>${testimonialSectionHtml}

    <section class="section section--flush-top" style="padding-block:0;">
      <nav class="case-pager" aria-label="Previous and next naming projects">
        <a href="/work/${prev.id}" class="case-pager__link">
          <span class="eyebrow">← Previous project · ${escapeHtml(prev.num)}</span>
          <span class="case-pager__name">${escapeHtml(prev.name)}</span>
        </a>
        <a href="/work/${next.id}" class="case-pager__link case-pager__link--next">
          <span class="eyebrow">Next project · ${escapeHtml(next.num)} →</span>
          <span class="case-pager__name">${escapeHtml(next.name)}</span>
        </a>
      </nav>
    </section>
  </main>`;
}

function generateLlmsTxt(data, approvedTestimonials) {
  const featured = data.projects.filter((p) => p.featured);
  const leadQuote = approvedTestimonials.find((t) => t.featured) || approvedTestimonials[0];

  const lines = [
    '# Tim Burley: Creating great names',
    '',
    '> Independent UK brand naming consultant with twenty years leading name development projects for UK and international clients across brands, systems, places and typefaces. Every project is led directly by Tim Burley from strategy brief to trademark filing, typically in 4 to 6 weeks as a fixed-fee engagement.',
    '',
    '## Core Pages',
    '',
    `- [Home](${SITE_URL}/): Practice overview, featured work, agency and direct client routes, 5-stage process funnel, and clear boundaries.`,
    `- [Brand Naming Portfolio (14 Projects)](${SITE_URL}/work): Complete reverse-chronological archive of 14 named projects across healthcare, energy, technology, luxury, property, food, public sector and typefaces.`,
    `- [Approach, Process & Pitfalls](${SITE_URL}/process): Four name types, four watchwords (Simple, Memorable, Meaningful, Protectable), five-stage naming funnel (~1,000 names to 1 registered mark), and six common naming pitfalls.`,
    `- [About Tim Burley](${SITE_URL}/about): Background across twenty-five years in agencies and twenty years leading name development.`,
    `- [Start a Naming Brief](${SITE_URL}/brief): Three-minute structured brief for direct clients or partner agencies, or email names@timburley.com directly.`,
    `- [Full Markdown Dossier for Agents](${SITE_URL}/llms-full.txt): Single-file complete reference containing positioning, process, pitfalls, client testimonial, and all 14 case studies with UK IPO trademark links.`,
    '',
    '## Featured Named Projects',
    ''
  ];

  for (const p of featured) {
    const tm = p.trademarkUrl ? ` (Registered UK trademark: ${p.trademarkUrl})` : '';
    lines.push(`- [${p.name} (${p.launchDate}, ${p.category})](${SITE_URL}/work/${p.id}): ${p.sector}.${tm}`);
  }

  lines.push('', '## All Named Projects', '');
  for (const p of data.projects) {
    lines.push(`- [${p.name} (${p.launchDate})](${SITE_URL}/work/${p.id}): ${p.sector}.`);
  }

  if (leadQuote) {
    lines.push(
      '',
      '## Client Perspective',
      '',
      `> ${stripTags(leadQuote.quote)} (${leadQuote.author}, ${leadQuote.role})`
    );
  }

  lines.push(
    '',
    '## Direct Contact',
    '',
    `- Email: ${data.contactEmail}`,
    `- Direct client brief: ${SITE_URL}/brief?route=direct`,
    `- Agency partnership enquiry: ${SITE_URL}/brief?route=agency`,
    ''
  );

  return lines.join('\n');
}

function generateLlmsFullTxt(data, approvedTestimonials) {
  const lines = [
    '# Tim Burley: Creating great names (Complete Reference)',
    '',
    `Canonical URL: ${SITE_URL}/`,
    `Contact: ${data.contactEmail}`,
    'Location: United Kingdom (working with UK and international clients)',
    'Role: Independent Brand Naming Consultant',
    'Experience: 20 years leading name development projects across 25 years in brand, design and digital agencies.',
    '',
    '## Positioning & Offer',
    '',
    'Tim Burley creates distinctive, trademark-ready names that boards align behind and lawyers can register. Work spans company and brand names, post-merger naming, sub-brands and naming architectures, products and SaaS platforms, property and place names, and typefaces.',
    '',
    'Two ways to work together:',
    `- **For Agencies (${SITE_URL}/brief?route=agency):** Specialist naming plugged directly into design, brand or digital agency projects without carrying permanent naming headcount. Seamless client-facing collaboration alongside strategists, designers and account leads.`,
    `- **For Direct Clients (${SITE_URL}/brief?route=direct):** Direct access to the person doing the naming, from strategy brief through shortlist workshops and alignment alongside your trademark attorney.`,
    '',
    '## Commercial Model & Process',
    '',
    '- Typical timeframe: 4 to 6 weeks from strategy brief to trademark filing.',
    '- Commercial structure: Fixed-fee engagement scoped once the brief and approval pipeline are agreed.',
    '- Three ingredients: (1) One senior namer (no junior hand-offs), (2) An agreed approval pipeline set before naming starts, (3) Independent trademark attorney clearance (your IP partner handles formal registration; Tim pre-screens candidates to cut wasted legal spend).',
    '',
    'Five-stage funnel:',
    '1. **Strategy & territories (The brief):** Agree commercial strategy, audience, naming territories and decision-makers.',
    '2. **Long-listing (~1,000 to ~100 names):** Deep linguistic, metaphorical and contextual exploration edited down to ~100 strong candidates.',
    '3. **Shortlisting (12 to 15 pre-screened names):** Checked across UK/EU/US registers, domains and social handles before presentation.',
    '4. **Selection (3 to 4 favourites):** Presented to the smallest viable deciding group to prevent committee dilution.',
    '5. **Clearance & filing (1 registered name):** Independent trademark attorney pre-registration report and filing support.',
    '',
    'Four watchwords: Simple, Memorable, Meaningful, Protectable.',
    '',
    'Four name types (the aviation spectrum):',
    '1. Literal / Descriptive (e.g. British Airways)',
    '2. Experiential / Suggestive (e.g. Virgin Atlantic)',
    '3. Associative / Metaphorical (e.g. Monarch)',
    '4. Abstract / Arbitrary (e.g. EasyJet)',
    '',
    '## Clear Boundaries (Four Things This Practice Does Not Do)',
    '',
    '- **No AI name-slop buckets:** No raw LLM prompt dumps of 400 derivative words. Every candidate passes human taste, commercial context and trademark judgement.',
    '- **No junior hand-offs:** You brief, challenge and decide directly with Tim Burley from start to finish.',
    '- **No amateur legal advice:** Formal registration belongs with a qualified trademark attorney; Tim prepares clean, registrable shortlists alongside them.',
    '- **No bloated 90-slide theatre:** Clear criteria, disciplined territories, rigorously edited shortlists and straight-talking decision guidance.',
    ''
  ];

  if (approvedTestimonials.length) {
    lines.push('## Verified Client & Agency Testimonials', '');
    for (const t of approvedTestimonials) {
      lines.push(`- ${stripTags(t.quote)} (${t.author}, ${t.role}; projects: ${t.projectLabel})`);
    }
    lines.push('');
  }

  lines.push('## Six Naming Pitfalls (Summary)', '');
  for (const pit of data.pitfalls) {
    lines.push(`### ${pit.num}. ${pit.title}`);
    lines.push(`- Pattern: ${stripTags(pit.subtitle)}`);
    lines.push(`- Why it happens: ${stripTags(pit.whyItHappens)}`);
    lines.push(`- How the process prevents it: ${stripTags(pit.antidote)}`);
    lines.push('');
  }

  lines.push('## Named Projects (14 Case Studies, Reverse Chronological)', '');
  for (const p of data.projects) {
    lines.push(`### ${p.num}. ${p.name} (${p.launchDate}) · ${p.category}`);
    lines.push(`- Case study URL: ${SITE_URL}/work/${p.id}`);
    lines.push(`- Summary: ${stripTags(p.summary)}`);
    lines.push(`- Client: ${p.client}`);
    lines.push(`- Agency partner: ${p.agencyPartner}`);
    lines.push(`- Domain: ${p.domain}`);
    lines.push(`- Trademark: ${p.trademarkUrl ? `Registered (${p.trademarkUrl})` : 'Unregistered'}`);
    lines.push(`- Brief: ${stripTags(p.brief)}`);
    lines.push(`- Naming story: ${stripTags(p.story)}`);
    lines.push(`- Process & clearance: ${stripTags(p.processNote)}`);
    lines.push(`- Outcome: ${stripTags(p.outcome)}`);
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  const data = loadData();
  const approvedTestimonials = (data.testimonials || []).filter((t) => !t.isPlaceholder);
  const leadTestimonial = approvedTestimonials.find((t) => t.featured) || approvedTestimonials[0] || null;
  const projects = data.projects || [];

  const personNode = {
    '@type': 'Person',
    '@id': `${SITE_URL}/#person`,
    name: 'Tim Burley',
    jobTitle: 'Brand Naming Consultant',
    url: `${SITE_URL}/`,
    email: `mailto:${data.contactEmail}`,
    image: `${SITE_URL}/assets/images/tim/tim-seated.jpg`,
    description:
      'Independent UK brand naming consultant with twenty years leading name development projects across brands, systems, places and typefaces.',
    knowsAbout: [
      'Brand naming',
      'Name development',
      'Brand architecture',
      'Trademark pre-screening',
      'Product naming',
      'Place and property naming',
      'Typeface naming'
    ]
  };

  const serviceNode = {
    '@type': 'ProfessionalService',
    '@id': `${SITE_URL}/#practice`,
    name: 'Tim Burley · Creating great names',
    url: `${SITE_URL}/`,
    email: data.contactEmail,
    image: DEFAULT_OG_IMAGE,
    description:
      'Independent UK brand naming consultancy creating distinctive, trademark-ready names for direct clients and partner agencies in 4 to 6 weeks.',
    founder: { '@id': `${SITE_URL}/#person` },
    areaServed: ['United Kingdom', 'International'],
    serviceType: [
      'Brand Naming',
      'Post-Merger Naming',
      'Product & Platform Naming',
      'Property & Place Naming',
      'Agency Naming Partnership'
    ]
  };

  if (leadTestimonial) {
    serviceNode.review = {
      '@type': 'Review',
      reviewBody: stripTags(leadTestimonial.quote).replace(/^[“"]|[”"]$/g, ''),
      author: {
        '@type': 'Organization',
        name: `${leadTestimonial.author}, ${leadTestimonial.role}`
      }
    };
  }

  // 1. Homepage (public/index.html)
  {
    const file = path.join(PUBLIC, 'index.html');
    let html = fs.readFileSync(file, 'utf8');
    const head = buildHead({
      title: 'Tim Burley · Brand Naming Consultant, UK · Creating great names',
      description:
        'UK brand naming consultant creating distinctive, trademark-ready names across brands, systems, places and typefaces. Twenty years leading naming projects.',
      canonicalPath: '/',
      ogType: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': `${SITE_URL}/#website`,
            url: `${SITE_URL}/`,
            name: 'Tim Burley · Creating great names',
            inLanguage: 'en-GB'
          },
          personNode,
          serviceNode
        ]
      }
    });
    html = replaceHead(html, head);
    html = bumpAssetVersions(html);

    const featuredCardsHtml = projects
      .filter((p) => p.featured)
      .map((p) => renderSpecimenCardHtml(p, projects.length, false))
      .join('\n');
    html = replaceContainerById(html, 'featured-specimens', featuredCardsHtml);

    if (leadTestimonial) {
      html = replaceContainerById(
        html,
        'featured-testimonial',
        renderTestimonialCardHtml(leadTestimonial, true)
      );
    }

    fs.writeFileSync(file, html, 'utf8');
  }

  // 2. Work index (public/work/index.html)
  {
    const file = path.join(PUBLIC, 'work/index.html');
    let html = fs.readFileSync(file, 'utf8');
    const head = buildHead({
      title: 'Brand Naming Portfolio · 14 Named Projects · Tim Burley',
      description:
        'Fourteen brand naming projects led across healthcare, clean energy, SaaS, luxury, food, public sector, property and typefaces, with UK trademark records.',
      canonicalPath: '/work',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Brand Naming Portfolio · 14 Named Projects',
        url: `${SITE_URL}/work`,
        inLanguage: 'en-GB',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: projects.length,
          itemListElement: projects.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: p.name,
            url: `${SITE_URL}/work/${p.id}`
          }))
        }
      }
    });
    html = replaceHead(html, head);
    html = bumpAssetVersions(html);

    const categories = ['All', ...Array.from(new Set(projects.map((p) => p.category)))];
    const filtersHtml = categories
      .map((cat) => {
        const count = cat === 'All' ? projects.length : projects.filter((p) => p.category === cat).length;
        return `          <button type="button" class="filter-pill${cat === 'All' ? ' is-active' : ''}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)} (${count})</button>`;
      })
      .join('\n');
    html = replaceContainerById(html, 'work-filters', filtersHtml);

    const allCardsHtml = projects
      .map((p) => renderSpecimenCardHtml(p, projects.length, true))
      .join('\n');
    html = replaceContainerById(html, 'work-specimens', allCardsHtml);

    fs.writeFileSync(file, html, 'utf8');
  }

  // 3. Process & Pitfalls (public/process/index.html)
  {
    const file = path.join(PUBLIC, 'process/index.html');
    let html = fs.readFileSync(file, 'utf8');
    const head = buildHead({
      title: 'Brand Naming Process & Pitfalls · Tim Burley',
      description:
        'How a brand naming project runs in 4 to 6 weeks: four name types, four watchwords, five stages from strategy to trademark filing, and six pitfalls to avoid.',
      canonicalPath: '/process',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'HowTo',
            name: 'How a brand naming project runs from strategy to trademark filing',
            totalTime: 'P5W',
            step: [
              { '@type': 'HowToStep', position: 1, name: 'Strategy & territories', text: 'Define commercial brief, audience, naming territories and decision-makers.' },
              { '@type': 'HowToStep', position: 2, name: 'Long-listing', text: 'Explore ~1,000 directions and edit down to ~100 strong name candidates.' },
              { '@type': 'HowToStep', position: 3, name: 'Shortlisting', text: 'Pre-screen 12 to 15 candidates across trademark registers, domains and social handles.' },
              { '@type': 'HowToStep', position: 4, name: 'Selection', text: 'Present to the smallest viable deciding group to identify 3 to 4 favourites.' },
              { '@type': 'HowToStep', position: 5, name: 'Clearance & filing', text: 'Support independent trademark attorney clearance and filing for 1 registered name.' }
            ]
          },
          {
            '@type': 'FAQPage',
            mainEntity: (data.pitfalls || []).map((pit) => ({
              '@type': 'Question',
              name: `What is ${pit.title} in brand naming?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `${stripTags(pit.whyItHappens)} ${stripTags(pit.antidote)}`
              }
            }))
          }
        ]
      }
    });
    html = replaceHead(html, head);
    html = bumpAssetVersions(html);
    html = replaceContainerById(html, 'pitfalls-container', renderPitfallsHtml(data.pitfalls || []));
    fs.writeFileSync(file, html, 'utf8');
  }

  // 4. About (public/about/index.html)
  {
    const file = path.join(PUBLIC, 'about/index.html');
    let html = fs.readFileSync(file, 'utf8');
    const head = buildHead({
      title: 'About Tim Burley · UK Brand Naming Consultant',
      description:
        'Twenty years leading brand naming projects across twenty-five years in agencies, working directly with founders, organisations and partner agencies.',
      canonicalPath: '/about',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        url: `${SITE_URL}/about`,
        inLanguage: 'en-GB',
        mainEntity: personNode
      }
    });
    html = replaceHead(html, head);
    html = bumpAssetVersions(html);
    fs.writeFileSync(file, html, 'utf8');
  }

  // 5. Brief (public/brief/index.html)
  {
    const file = path.join(PUBLIC, 'brief/index.html');
    let html = fs.readFileSync(file, 'utf8');
    const head = buildHead({
      title: 'Start a Brand Naming Brief · Tim Burley',
      description:
        'Share your naming brief in three minutes. Direct to Tim Burley for agency partnerships or direct client projects, scoped as a clear fixed-fee engagement.',
      canonicalPath: '/brief',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'Start a Brand Naming Brief',
        url: `${SITE_URL}/brief`,
        inLanguage: 'en-GB',
        mainEntity: { '@id': `${SITE_URL}/#practice` }
      }
    });
    html = replaceHead(html, head);
    html = bumpAssetVersions(html);
    fs.writeFileSync(file, html, 'utf8');
  }

  // 6. 404 (public/404.html)
  {
    const file = path.join(PUBLIC, '404.html');
    let html = fs.readFileSync(file, 'utf8');
    const head = buildHead({
      title: 'Page Not Found · Tim Burley',
      description: '',
      canonicalPath: null,
      noindex: true
    });
    html = replaceHead(html, head);
    html = bumpAssetVersions(html);
    fs.writeFileSync(file, html, 'utf8');
  }

  // 7. All 14 Individual Case Study Pages (public/work/<slug>/index.html)
  projects.forEach((project, idx) => {
    const file = path.join(PUBLIC, 'work', project.id, 'index.html');
    let html = fs.readFileSync(file, 'utf8');

    const title = `${project.name} · ${project.category} Naming Case Study · Tim Burley`;
    const description = truncateDesc(
      `How ${project.name} was named: ${stripTags(project.summary)}`
    );
    const ogImage = project.visualImage ? `${SITE_URL}${project.visualImage}` : DEFAULT_OG_IMAGE;
    const ogImageAlt = project.visualCaption
      ? `${project.name}: ${project.visualCaption}`
      : `${project.name} brand naming case study by Tim Burley`;

    const head = buildHead({
      title,
      description,
      canonicalPath: `/work/${project.id}`,
      ogType: 'article',
      ogImage,
      ogImageAlt,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'CreativeWork',
            name: `${project.name} Brand Naming Case Study`,
            headline: `How ${project.name} came to be`,
            description: stripTags(project.summary),
            url: `${SITE_URL}/work/${project.id}`,
            datePublished: `${project.launchDate}-01-01`,
            inLanguage: 'en-GB',
            image: ogImage,
            author: { '@id': `${SITE_URL}/#person` },
            about: project.category
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
              { '@type': 'ListItem', position: 2, name: 'Work', item: `${SITE_URL}/work` },
              { '@type': 'ListItem', position: 3, name: project.name, item: `${SITE_URL}/work/${project.id}` }
            ]
          }
        ]
      }
    });

    html = replaceHead(html, head);
    html = bumpAssetVersions(html);
    html = html.replace(
      /<main id="main"[\s\S]*?<\/main>/,
      renderCaseStudyMain(project, idx, projects, approvedTestimonials)
    );
    fs.writeFileSync(file, html, 'utf8');
  });

  // 8. robots.txt
  const robotsTxt = [
    '# timburley.com · Tim Burley · Brand Naming Consultant, UK',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
    '# Machine-readable guides for AI assistants and agents:',
    `# ${SITE_URL}/llms.txt`,
    `# ${SITE_URL}/llms-full.txt`,
    ''
  ].join('\n');
  fs.writeFileSync(path.join(PUBLIC, 'robots.txt'), robotsTxt, 'utf8');

  // 9. sitemap.xml
  const sitemapEntries = [
    { loc: `${SITE_URL}/`, priority: '1.0' },
    { loc: `${SITE_URL}/work`, priority: '0.9' },
    { loc: `${SITE_URL}/process`, priority: '0.8' },
    { loc: `${SITE_URL}/about`, priority: '0.8' },
    { loc: `${SITE_URL}/brief`, priority: '0.8' },
    ...projects.map((p) => ({
      loc: `${SITE_URL}/work/${p.id}`,
      priority: p.featured ? '0.8' : '0.7'
    }))
  ];
  const sitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapEntries.map(
      (e) =>
        `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${LASTMOD}</lastmod>\n    <priority>${e.priority}</priority>\n  </url>`
    ),
    '</urlset>',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'), sitemapXml, 'utf8');

  // 10. llms.txt & llms-full.txt
  fs.writeFileSync(path.join(PUBLIC, 'llms.txt'), generateLlmsTxt(data, approvedTestimonials), 'utf8');
  fs.writeFileSync(
    path.join(PUBLIC, 'llms-full.txt'),
    generateLlmsFullTxt(data, approvedTestimonials),
    'utf8'
  );

  console.log(
    `Synced 20 HTML pages (pre-rendered ${projects.length} case studies, work grid, featured home cards, 6 pitfalls), robots.txt, sitemap.xml (${sitemapEntries.length} URLs), llms.txt, and llms-full.txt (v=${ASSET_VERSION}).`
  );
}

main();
