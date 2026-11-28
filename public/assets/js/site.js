/* ==========================================================================
   timburley.com · Interactive Layer
   Navigation, specimen links, individual case study pages, testimonials,
   portrait rendering, interactive pitfalls & guided brief.
   ========================================================================== */

(function () {
  'use strict';

  const DATA = window.TB_DATA || {};

  /* ------------------------------------------------------------------------
     1. Mobile Menu
     ------------------------------------------------------------------------ */
  function initMobileMenu() {
    const toggle = document.querySelector('[data-menu-toggle]');
    const menu = document.querySelector('[data-mobile-menu]');
    if (!toggle || !menu) return;

    menu.setAttribute('aria-hidden', 'true');

    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-hidden', String(!open));
      toggle.textContent = open ? 'Close' : 'Menu';
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
        toggle.textContent = 'Menu';
        toggle.focus();
      }
    });
  }

  /* ------------------------------------------------------------------------
     2. Subtle Scroll Reveals (immediate for elements already in viewport)
     ------------------------------------------------------------------------ */
  function initReveals() {
    const nodes = document.querySelectorAll('.reveal');
    if (!nodes.length) return;

    if (!('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }

    const viewportH = window.innerHeight || 900;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: '0px 0px -10px 0px' }
    );

    nodes.forEach((n) => {
      const rect = n.getBoundingClientRect();
      if (rect.top < viewportH) {
        n.classList.add('is-visible');
      } else {
        observer.observe(n);
      }
    });
  }

  /* ------------------------------------------------------------------------
     3. Portrait Hydration (swaps in Tim's photo automatically when added)
     ------------------------------------------------------------------------ */
  function initPortraits() {
    const slots = document.querySelectorAll('[data-portrait-media]');
    if (!slots.length || !DATA.portrait) return;

    if (DATA.portrait.src) {
      slots.forEach((slot) => {
        slot.innerHTML = `<img src="${DATA.portrait.src}" alt="${DATA.portrait.alt || 'Tim Burley'}">`;
      });
    }
  }

  /* ------------------------------------------------------------------------
     4. Specimen Cards (Link Directly to Individual /work/<slug> Pages)
     ------------------------------------------------------------------------ */
  function renderSpecimenCard(project, showIndex = true) {
    const styleClass =
      project.style === 'sans'
        ? 'specimen-card__wordmark--sans'
        : project.style === 'italic'
        ? 'specimen-card__wordmark--italic'
        : '';

    const link = document.createElement('a');
    link.href = `/work/${project.id}`;
    link.className = 'specimen-card';
    link.setAttribute('aria-label', `Read the naming story for ${project.name}`);
    const topLeftHtml = showIndex
      ? `<span class="specimen-card__num">${project.num} / ${DATA.projects.length}</span>`
      : '';
    link.innerHTML = `
      <div class="specimen-card__top">
        ${topLeftHtml}
        <span class="specimen-card__cat">${project.category}</span>
      </div>
      <div>
        <h3 class="specimen-card__wordmark ${styleClass}">${project.name}</h3>
        <p class="specimen-card__sector">${project.sector}</p>
      </div>
      <div class="specimen-card__foot">
        <span>${project.launchDate}</span>
        <span>Read story →</span>
      </div>
    `;
    return link;
  }

  function initSpecimens() {
    const featuredEl = document.getElementById('featured-specimens');
    if (featuredEl && DATA.projects && !featuredEl.querySelector('.specimen-card')) {
      featuredEl.innerHTML = '';
      DATA.projects
        .filter((p) => p.featured)
        .forEach((p) => featuredEl.appendChild(renderSpecimenCard(p, false)));
    }

    const workEl = document.getElementById('work-specimens');
    const filterBar = document.getElementById('work-filters');
    if (workEl && DATA.projects) {
      const categories = ['All', ...Array.from(new Set(DATA.projects.map((p) => p.category)))];
      let activeCategory = 'All';

      function renderGrid() {
        workEl.innerHTML = '';
        const list =
          activeCategory === 'All'
            ? DATA.projects
            : DATA.projects.filter((p) => p.category === activeCategory);
        list.forEach((p) => workEl.appendChild(renderSpecimenCard(p)));
      }

      if (filterBar) {
        filterBar.innerHTML = '';
        categories.forEach((cat) => {
          const count =
            cat === 'All'
              ? DATA.projects.length
              : DATA.projects.filter((p) => p.category === cat).length;
          const pill = document.createElement('button');
          pill.type = 'button';
          pill.className = `filter-pill ${cat === 'All' ? 'is-active' : ''}`;
          pill.textContent = `${cat} (${count})`;
          pill.addEventListener('click', () => {
            activeCategory = cat;
            filterBar.querySelectorAll('.filter-pill').forEach((b) => b.classList.remove('is-active'));
            pill.classList.add('is-active');
            renderGrid();
          });
          filterBar.appendChild(pill);
        });
      }

      if (!workEl.querySelector('.specimen-card')) {
        renderGrid();
      }
    }
  }

  /* ------------------------------------------------------------------------
     5. Testimonials Renderer (Home + Relevant Case Studies)
     ------------------------------------------------------------------------ */
  function buildTestimonialCard(t, isFeatured = false) {
    const card = document.createElement('article');
    card.className = isFeatured ? 'testimonial-card testimonial-card--featured' : 'testimonial-card';
    card.innerHTML = `
      <div>
        ${t.isPlaceholder ? '<span class="testimonial-card__badge">Placeholder quote · Ready for sign-off</span>' : ''}
        <blockquote class="testimonial-card__quote" style="${t.isPlaceholder ? 'margin-top:1rem;' : ''}">${t.quote}</blockquote>
      </div>
      <div class="testimonial-card__meta">
        <div>
          <div class="testimonial-card__author">${t.author}</div>
          <div class="testimonial-card__role">${t.role}</div>
        </div>
        <span class="testimonial-card__project">${t.projectLabel}</span>
      </div>
    `;
    return card;
  }

  function initTestimonials() {
    const approved = (DATA.testimonials || []).filter((t) => !t.isPlaceholder);
    const featuredSlot = document.getElementById('featured-testimonial');
    const grid = document.getElementById('testimonials-grid');
    const section = document.getElementById('testimonials');

    const featured = approved.find((t) => t.featured) || approved[0] || null;
    const rest = featured ? approved.filter((t) => t.id !== featured.id) : approved;

    if (featuredSlot && !featuredSlot.querySelector('.testimonial-card')) {
      featuredSlot.innerHTML = '';
      if (featured) {
        featuredSlot.appendChild(buildTestimonialCard(featured, true));
      } else {
        featuredSlot.style.display = 'none';
      }
    }

    if (grid) {
      grid.innerHTML = '';
      grid.classList.toggle('testimonials-grid--3', rest.length === 3);
      if (rest.length === 0 && section) {
        section.style.display = 'none';
      } else {
        rest.forEach((t) => grid.appendChild(buildTestimonialCard(t)));
      }
    }
  }

  /* ------------------------------------------------------------------------
     6. Individual Case Study Page Renderer (/work/<slug>)
     ------------------------------------------------------------------------ */
  function initCaseStudyPage() {
    const root = document.querySelector('[data-case-study]');
    if (!root || !DATA.projects) return;
    if (root.getAttribute('data-prerendered') === 'true' && root.querySelector('.case-story-grid')) {
      return;
    }

    const slug = root.getAttribute('data-case-study');
    const idx = DATA.projects.findIndex((p) => p.id === slug);
    if (idx === -1) return;

    const project = DATA.projects[idx];
    const prev = DATA.projects[(idx - 1 + DATA.projects.length) % DATA.projects.length];
    const next = DATA.projects[(idx + 1) % DATA.projects.length];

    const styleClass =
      project.style === 'sans'
        ? 'case-visual-stage__specimen--sans'
        : project.style === 'italic'
        ? 'case-visual-stage__specimen--italic'
        : '';

    const footRightHtml =
      project.imageCredit && project.caseStudyUrl
        ? `<span>Image © <a href="${project.caseStudyUrl}" target="_blank" rel="noopener noreferrer" class="text-link" style="font-family:var(--font-mono); font-size:0.72rem;">Believe in</a>, ${project.launchDate}</span>`
        : project.liveUrl
        ? `<span><a href="${project.liveUrl}" target="_blank" rel="noopener noreferrer" class="text-link" style="font-family:var(--font-mono); font-size:0.72rem;">${project.liveUrlLabel || 'Visit live brand ↗'}</a></span>`
        : '';

    const domainHtml =
      project.liveUrl && !project.liveUrlLabel && project.domain && project.domain !== 'N/A'
        ? `<a href="${project.liveUrl}" target="_blank" rel="noopener noreferrer" class="text-link">${project.domain} ↗</a>`
        : project.domain || 'N/A';

    const trademarkHtml = project.trademarkUrl
      ? `<a href="${project.trademarkUrl}" target="_blank" rel="noopener noreferrer" class="text-link">Registered ↗</a>`
      : 'Unregistered';

    const dimAttrs =
      project.visualWidth && project.visualHeight
        ? ` width="${project.visualWidth}" height="${project.visualHeight}"`
        : '';

    const visualStageHtml = project.visualImage
      ? `
          <figure class="case-visual-stage case-visual-stage--media" style="margin:0 0 2.5rem;">
            <img class="case-visual-stage__image" src="${project.visualImage}" alt="${project.name}: ${project.visualCaption}"${dimAttrs} fetchpriority="high" decoding="async">
            <figcaption class="case-visual-stage__foot">
              <span>${project.visualCaption}</span>
              ${footRightHtml}
            </figcaption>
          </figure>`
      : '';

    const testimonial = project.testimonialId
      ? (DATA.testimonials || []).find((t) => t.id === project.testimonialId && !t.isPlaceholder)
      : null;

    root.innerHTML = `
      <section class="hero" style="padding-bottom:2.75rem;">
        <div class="container">
          <a href="/work" class="case-crumb">← All ${DATA.projects.length} named projects</a>
          <div class="case-header-row">
            <span class="eyebrow">${project.num} / ${DATA.projects.length} · ${project.launchDate} · ${project.category}</span>
          </div>
          <h1 class="h-display" style="margin-bottom:1.15rem;">${project.name}</h1>
          <p class="lead" style="margin:0;">${project.summary}</p>
        </div>
      </section>

      <section class="section section--flush-top" style="padding-top:0.5rem;">
        <div class="container">
          ${visualStageHtml}

          <dl class="case-meta-ledger">
            <div>
              <dt>Brand name</dt>
              <dd>${project.name}</dd>
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
              <dd>${project.agencyPartner || 'Direct'}</dd>
            </div>
            <div>
              <dt>Client</dt>
              <dd>${project.client || 'N/A'}</dd>
            </div>
            <div>
              <dt>Launch date</dt>
              <dd>${project.launchDate || 'TBC'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="section section--flush-top" style="padding-top:2rem;">
        <div class="container">
          <div class="case-story-grid">
            <div class="case-story-aside">
              <h2 class="h-section">How <em>${project.name}</em> came to be.</h2>
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
      </section>

      ${
        testimonial
          ? `
      <section class="section section--stone">
        <div class="container container--narrow">
          <span class="eyebrow" style="display:block; margin-bottom:1.25rem;">Client &amp; Partner Perspective</span>
          <div id="case-testimonial-slot"></div>
        </div>
      </section>`
          : ''
      }

      <section class="section section--flush-top" style="padding-block:0;">
        <nav class="case-pager" aria-label="Previous and next naming projects">
          <a href="/work/${prev.id}" class="case-pager__link">
            <span class="eyebrow">← Previous · ${prev.num} / ${DATA.projects.length}</span>
            <span class="case-pager__name">${prev.name}</span>
            <span class="muted" style="font-size:0.9rem;">${prev.sector}</span>
          </a>
          <a href="/work/${next.id}" class="case-pager__link case-pager__link--next">
            <span class="eyebrow">Next · ${next.num} / ${DATA.projects.length} →</span>
            <span class="case-pager__name">${next.name}</span>
            <span class="muted" style="font-size:0.9rem;">${next.sector}</span>
          </a>
        </nav>
      </section>
    `;

    if (testimonial) {
      const slot = root.querySelector('#case-testimonial-slot');
      if (slot) slot.appendChild(buildTestimonialCard(testimonial));
    }
  }

  /* ------------------------------------------------------------------------
     7. Interactive Naming Pitfalls (/process)
     ------------------------------------------------------------------------ */
  function initPitfalls() {
    const container = document.getElementById('pitfalls-container');
    if (!container || !DATA.pitfalls) return;

    const flagged = new Set();

    container.innerHTML = '';
    DATA.pitfalls.forEach((item, index) => {
      const el = document.createElement('article');
      el.className = `pitfall-item ${index === 0 ? 'is-open' : ''}`;
      el.innerHTML = `
        <button type="button" class="pitfall-trigger" aria-expanded="${index === 0 ? 'true' : 'false'}">
          <span class="pitfall-trigger__num">${item.num}</span>
          <span>
            <span class="pitfall-trigger__title">${item.title}</span>
            <span class="pitfall-trigger__subtitle">${item.subtitle}</span>
          </span>
          <span class="pitfall-trigger__icon" aria-hidden="true">+</span>
        </button>
        <div class="pitfall-panel" aria-hidden="${index === 0 ? 'false' : 'true'}">
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
            <button type="button" class="pitfall-flag-btn" data-pitfall-id="${item.id}" aria-pressed="false">
              <span class="pitfall-flag-icon">○</span>
              <span>We’ve seen this in our organisation</span>
            </button>
          </div>
        </div>
      `;

      const trigger = el.querySelector('.pitfall-trigger');
      const panel = el.querySelector('.pitfall-panel');
      trigger.addEventListener('click', () => {
        const isOpen = el.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', String(isOpen));
        if (panel) panel.setAttribute('aria-hidden', String(!isOpen));
      });

      const flagBtn = el.querySelector('.pitfall-flag-btn');
      flagBtn.addEventListener('click', () => {
        if (flagged.has(item.id)) {
          flagged.delete(item.id);
          flagBtn.classList.remove('is-active');
          flagBtn.setAttribute('aria-pressed', 'false');
          el.classList.remove('is-flagged');
          flagBtn.querySelector('.pitfall-flag-icon').textContent = '○';
        } else {
          flagged.add(item.id);
          flagBtn.classList.add('is-active');
          flagBtn.setAttribute('aria-pressed', 'true');
          el.classList.add('is-flagged');
          flagBtn.querySelector('.pitfall-flag-icon').textContent = '●';
        }
        updateDiagnostic();
      });

      container.appendChild(el);
    });

    const diagTitle = document.getElementById('pitfall-diag-title');
    const diagBody = document.getElementById('pitfall-diag-body');
    const diagLink = document.getElementById('pitfall-diag-link');

    function updateDiagnostic() {
      if (!diagTitle || !diagBody || !diagLink) return;
      const count = flagged.size;
      if (count === 0) {
        diagTitle.textContent = 'Recognise any of these from past projects?';
        diagBody.textContent =
          'Tick any pitfalls you want to guard against. We can carry them straight into your naming brief so we design the decision process around them from day one.';
        diagLink.href = '/brief';
        diagLink.textContent = 'Start a guided brief →';
      } else {
        const titles = DATA.pitfalls
          .filter((p) => flagged.has(p.id))
          .map((p) => p.title);
        diagTitle.textContent =
          count === 1
            ? `1 pitfall flagged: ${titles[0]}`
            : `${count} pitfalls flagged for your brief`;
        diagBody.textContent = `Flagged: ${titles.join(', ')}. Bringing these into the brief upfront lets us set clear criteria and an approval pipeline before a single name is written.`;
        diagLink.href = `/brief?pitfalls=${encodeURIComponent(titles.join(' | '))}`;
        diagLink.textContent = 'Carry these into your brief →';
      }
    }

    updateDiagnostic();
  }

  function initPitfallPreviews() {
    const container = document.getElementById('home-pitfalls-preview');
    if (!container || !DATA.pitfalls) return;

    const featuredIds = ['thunderbolt-fallacy', 'straw-poll', 'front-runner'];
    const selected = featuredIds
      .map((id) => DATA.pitfalls.find((p) => p.id === id))
      .filter(Boolean);

    container.innerHTML = '';
    selected.forEach((item) => {
      const card = document.createElement('a');
      card.href = `/process#pitfalls`;
      card.className = 'pitfall-preview-card';
      card.innerHTML = `
        <span class="pitfall-preview-card__num">PITFALL ${item.num}</span>
        <h3>${item.title}</h3>
        <p class="pitfall-preview-card__quote">${item.heardInMeeting}</p>
        <span class="pitfall-preview-card__link">See how to prevent it →</span>
      `;
      container.appendChild(card);
    });
  }

  /* ------------------------------------------------------------------------
     8. Single-Page Naming Brief (/brief) + /api/brief Resend Delivery
     ------------------------------------------------------------------------ */
  function initBriefForm() {
    const form = document.getElementById('brief-form');
    if (!form) return;

    const state = {
      route: '',
      name: '',
      organisation: '',
      email: '',
      namingType: '',
      summary: '',
      dependencies: '',
      timeline: '',
      budget: '',
      deciders: '',
      trademark: '',
      pitfalls: '',
      refProject: ''
    };

    const params = new URLSearchParams(window.location.search);
    const notes = [];
    if (params.get('pitfalls')) {
      state.pitfalls = params.get('pitfalls');
      notes.push(`Flagged pitfalls: ${state.pitfalls}`);
    }
    if (params.get('ref')) {
      state.refProject = params.get('ref');
      notes.push(`Referenced project: ${state.refProject}`);
    }
    if (notes.length) {
      const banner = document.getElementById('brief-prefill-note');
      if (banner) {
        banner.textContent = notes.join(' · ');
        banner.style.display = 'block';
      }
    }

    form.querySelectorAll('[data-choice-group]').forEach((group) => {
      const key = group.getAttribute('data-choice-group');
      const pills = group.querySelectorAll('.brief-pill');
      pills.forEach((pill) => {
        pill.addEventListener('click', () => {
          const alreadySelected = pill.classList.contains('is-selected');
          pills.forEach((p) => {
            p.classList.remove('is-selected');
            p.setAttribute('aria-pressed', 'false');
          });
          if (alreadySelected) {
            state[key] = '';
          } else {
            pill.classList.add('is-selected');
            pill.setAttribute('aria-pressed', 'true');
            state[key] = pill.getAttribute('data-value') || '';
          }
        });
      });
    });

    const routeParam = (params.get('route') || '').toLowerCase();
    if (routeParam === 'agency' || routeParam === 'direct') {
      const targetVal = routeParam === 'agency' ? 'Agency partner' : 'Direct client';
      const routeGroup = form.querySelector('[data-choice-group="route"]');
      const match = routeGroup?.querySelector(`.brief-pill[data-value="${targetVal}"]`);
      if (match) {
        match.classList.add('is-selected');
        match.setAttribute('aria-pressed', 'true');
        state.route = targetVal;
      }
      if (routeParam === 'agency') {
        const banner = document.getElementById('brief-prefill-note');
        if (banner) {
          const prefix = notes.length ? `${notes.join(' · ')} · ` : '';
          banner.innerHTML = `${prefix}Agency partner route selected. Prefer a quick chat before sharing a brief? Email <a href="mailto:${DATA.contactEmail}" class="text-link">${DATA.contactEmail}</a> directly.`;
          banner.style.display = 'block';
        }
      }
    }

    form.querySelectorAll('[data-field]').forEach((input) => {
      const key = input.getAttribute('data-field');
      input.addEventListener('input', () => {
        state[key] = input.value.trim();
      });
    });

    const copyBtn = document.getElementById('brief-copy');
    const printBtn = document.getElementById('brief-print');
    const submitBtn = document.getElementById('brief-submit-btn');
    const statusBanner = document.getElementById('brief-status');
    const sendCopyInput = document.getElementById('f-send-copy');
    const honeypotInput = document.getElementById('f-website');

    function syncFields() {
      form.querySelectorAll('[data-field]').forEach((input) => {
        const key = input.getAttribute('data-field');
        state[key] = input.value.trim();
      });
    }

    function buildFormattedBrief() {
      syncFields();
      const lines = [
        'NAMING BRIEF · Tim Burley (Creating great names)',
        '========================================',
        `Commissioning route: ${state.route || 'Not specified'}`,
        `Name: ${state.name || 'Not specified'}`,
        `Organisation / agency: ${state.organisation || 'Not specified'}`,
        `Email: ${state.email || 'Not specified'}`,
        '',
        'THE BRIEF',
        `Type of name: ${state.namingType || 'Not specified'}`,
        `Summary: ${state.summary || 'Not specified'}`,
        `What already exists / dependencies: ${state.dependencies || 'Not specified'}`,
        state.refProject ? `Referenced project: ${state.refProject}` : null,
        '',
        'TIMING, BUDGET & SIGN-OFF',
        `Timeline & hard milestones: ${state.timeline || 'Not specified'}`,
        `Indicative budget: ${state.budget || 'Not specified'}`,
        `Deciding group & sign-off: ${state.deciders || 'Not specified'}`,
        `Trademark territories & legal partner: ${state.trademark || 'Not specified'}`,
        state.pitfalls ? `Flagged pitfalls: ${state.pitfalls}` : null
      ];
      return lines.filter((l) => l !== null).join('\n');
    }

    function buildMailtoHref() {
      const email = DATA.contactEmail || 'names@timburley.com';
      const subject = `Naming brief: ${state.organisation || state.name || state.namingType || 'New enquiry'}`;
      const body = buildFormattedBrief();
      return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    function showStatus(msg, type = 'info', includeMailto = false) {
      if (!statusBanner) return;
      statusBanner.className = 'status-banner is-visible';
      if (type === 'error') statusBanner.classList.add('status-banner--error');
      if (type === 'success') statusBanner.classList.add('status-banner--success');
      statusBanner.textContent = msg;

      if (includeMailto) {
        const sep = document.createTextNode(' ');
        const link = document.createElement('a');
        link.href = buildMailtoHref();
        link.className = 'text-link';
        link.textContent = 'Open in your email app →';
        statusBanner.appendChild(sep);
        statusBanner.appendChild(link);
      }
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const text = buildFormattedBrief();
        try {
          await navigator.clipboard.writeText(text);
          showStatus('Brief copied to your clipboard. Paste it into an email or share it with your team.', 'success');
        } catch {
          showStatus('Clipboard access was restricted by the browser. Use Print / Save PDF or email names@timburley.com directly.', 'error');
        }
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }

    const originalSubmitLabel = submitBtn ? submitBtn.textContent : 'Send me your brief →';
    let isSubmitted = false;

    function resetBriefForm() {
      isSubmitted = false;
      form.reset();
      Object.keys(state).forEach((k) => {
        if (k !== 'pitfalls' && k !== 'refProject') state[k] = '';
      });
      form.querySelectorAll('.brief-pill.is-selected').forEach((p) => {
        p.classList.remove('is-selected');
        p.setAttribute('aria-pressed', 'false');
      });
      if (submitBtn) {
        submitBtn.style.display = '';
        submitBtn.disabled = false;
        submitBtn.textContent = originalSubmitLabel;
      }
      if (statusBanner) {
        statusBanner.className = 'status-banner';
        statusBanner.textContent = '';
      }
      document.getElementById('f-summary')?.focus();
    }

    function showSentConfirmation(senderName) {
      if (!statusBanner) return;
      statusBanner.className = 'status-banner is-visible status-banner--success';
      statusBanner.textContent = '';

      const eyebrow = document.createElement('span');
      eyebrow.className = 'status-banner__eyebrow';
      eyebrow.textContent = 'Brief sent ✓';

      const msg = document.createElement('p');
      msg.style.margin = '0';
      msg.textContent = `Thank you, ${senderName}. I’ve received your brief and will come back to you personally within one working day.`;

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'status-banner__reset';
      resetBtn.textContent = 'Send another brief';
      resetBtn.addEventListener('click', resetBriefForm);

      statusBanner.appendChild(eyebrow);
      statusBanner.appendChild(msg);
      statusBanner.appendChild(resetBtn);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmitted) return;
      syncFields();

      if (!state.summary) {
        showStatus('Please add a short summary of the brief so I know what you’re naming.', 'error');
        document.getElementById('f-summary')?.focus();
        return;
      }
      if (!state.name) {
        showStatus('Please add your name so I know who I’m replying to.', 'error');
        document.getElementById('f-name')?.focus();
        return;
      }
      if (!state.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
        showStatus('Please enter a valid email address so I can reply to you.', 'error');
        document.getElementById('f-email')?.focus();
        return;
      }

      const payload = {
        ...state,
        sendCopy: Boolean(sendCopyInput?.checked),
        website: honeypotInput?.value || ''
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending brief…';
      }

      try {
        const res = await fetch('/api/brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        let result = {};
        try {
          result = await res.json();
        } catch {
          result = {};
        }

        if (res.ok && result.ok) {
          isSubmitted = true;
          if (submitBtn) {
            submitBtn.style.display = 'none';
          }
          showSentConfirmation(state.name);
          return;
        }

        if (res.status === 404 || res.status === 501 || result.code === 'NOT_CONFIGURED') {
          showStatus(
            'Direct sending isn’t active in this environment yet. You can copy the brief or send it via your email app.',
            'error',
            true
          );
        } else {
          showStatus(
            result.error || 'Could not send just now. Please try again or email names@timburley.com directly.',
            'error',
            true
          );
        }
      } catch {
        showStatus(
          'Network error while sending. Please try again or send via your email app.',
          'error',
          true
        );
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalSubmitLabel;
      }
    });
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initPortraits();
    initSpecimens();
    initTestimonials();
    initCaseStudyPage();
    initPitfalls();
    initPitfallPreviews();
    initBriefForm();
    initReveals();
  });
})();
