/* ==========================================================================
   timburley.com — Interactive Layer
   Navigation, specimen index, case drawer, interactive pitfalls & guided brief.
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

    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = 'Menu';
        toggle.focus();
      }
    });
  }

  /* ------------------------------------------------------------------------
     2. Subtle Scroll Reveals
     ------------------------------------------------------------------------ */
  function initReveals() {
    const nodes = document.querySelectorAll('.reveal');
    if (!nodes.length) return;

    if (!('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );

    nodes.forEach((n) => observer.observe(n));
  }

  /* ------------------------------------------------------------------------
     3. Specimen Cards & Case Study Drawer
     ------------------------------------------------------------------------ */
  let activeProjectIndex = -1;

  function renderSpecimenCard(project) {
    const styleClass =
      project.style === 'sans'
        ? 'specimen-card__wordmark--sans'
        : project.style === 'italic'
        ? 'specimen-card__wordmark--italic'
        : '';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'specimen-card';
    btn.setAttribute('data-project-id', project.id);
    btn.setAttribute('aria-label', `Read naming notes for ${project.name}`);
    btn.innerHTML = `
      <div class="specimen-card__top">
        <span class="specimen-card__num">${project.num} / 15</span>
        <span class="specimen-card__cat">${project.category}</span>
      </div>
      <div>
        <h3 class="specimen-card__wordmark ${styleClass}">${project.name}</h3>
        <p class="specimen-card__sector">${project.sector}</p>
      </div>
      <div class="specimen-card__foot">
        <span>${project.scope}</span>
        <span>Inspect →</span>
      </div>
    `;

    btn.addEventListener('click', () => openDrawer(project.id));
    return btn;
  }

  function ensureDrawer() {
    let drawer = document.getElementById('case-drawer');
    if (drawer) return drawer;

    const backdrop = document.createElement('div');
    backdrop.id = 'case-drawer-backdrop';
    backdrop.className = 'drawer-backdrop';
    backdrop.addEventListener('click', closeDrawer);

    drawer = document.createElement('aside');
    drawer.id = 'case-drawer';
    drawer.className = 'drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'drawer-project-name');
    drawer.innerHTML = `
      <div>
        <div class="drawer__top">
          <span class="eyebrow" id="drawer-index">01 / 15</span>
          <button type="button" class="drawer__close" id="drawer-close-btn">Close ×</button>
        </div>
        <div class="drawer__specimen">
          <span class="eyebrow" id="drawer-category"></span>
          <h2 class="drawer__title" id="drawer-project-name"></h2>
          <p class="muted" id="drawer-sector" style="margin:0;"></p>
        </div>
        <dl class="drawer__meta">
          <div>
            <dt>Scope</dt>
            <dd id="drawer-scope"></dd>
          </div>
          <div>
            <dt>Context</dt>
            <dd id="drawer-partner"></dd>
          </div>
        </dl>
        <div class="drawer__body">
          <h4>Summary</h4>
          <p id="drawer-summary"></p>
          <h4>The Naming Challenge</h4>
          <p id="drawer-challenge"></p>
          <h4>The Outcome</h4>
          <p id="drawer-approach"></p>
        </div>
      </div>
      <div style="border-top:1px solid var(--rule); padding-top:1.5rem; display:flex; flex-direction:column; gap:1rem;">
        <div style="display:flex; justify-content:space-between; gap:0.75rem;">
          <button type="button" class="btn btn--secondary btn--sm" id="drawer-prev">← Previous</button>
          <button type="button" class="btn btn--secondary btn--sm" id="drawer-next">Next →</button>
        </div>
        <a href="/brief" class="btn btn--primary" id="drawer-brief-link" style="width:100%;">Naming something similar? Start a brief →</a>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    drawer.querySelector('#drawer-close-btn').addEventListener('click', closeDrawer);
    drawer.querySelector('#drawer-prev').addEventListener('click', () => stepDrawer(-1));
    drawer.querySelector('#drawer-next').addEventListener('click', () => stepDrawer(1));

    document.addEventListener('keydown', (e) => {
      if (!drawer.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeDrawer();
      if (e.key === 'ArrowLeft') stepDrawer(-1);
      if (e.key === 'ArrowRight') stepDrawer(1);
    });

    return drawer;
  }

  function openDrawer(projectId) {
    const projects = DATA.projects || [];
    const idx = projects.findIndex((p) => p.id === projectId);
    if (idx === -1) return;
    activeProjectIndex = idx;

    const project = projects[idx];
    const drawer = ensureDrawer();
    const backdrop = document.getElementById('case-drawer-backdrop');

    drawer.querySelector('#drawer-index').textContent = `${project.num} / ${projects.length}`;
    drawer.querySelector('#drawer-category').textContent = project.category;
    const titleEl = drawer.querySelector('#drawer-project-name');
    titleEl.textContent = project.name;
    titleEl.style.fontStyle = project.style === 'italic' ? 'italic' : 'normal';
    drawer.querySelector('#drawer-sector').textContent = project.sector;
    drawer.querySelector('#drawer-scope').textContent = project.scope;
    drawer.querySelector('#drawer-partner').textContent = project.partner;
    drawer.querySelector('#drawer-summary').textContent = project.summary;
    drawer.querySelector('#drawer-challenge').textContent = project.challenge;
    drawer.querySelector('#drawer-approach').textContent = project.approach;
    drawer.querySelector('#drawer-brief-link').href = `/brief?ref=${encodeURIComponent(project.name)}`;

    backdrop.classList.add('is-open');
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    drawer.querySelector('#drawer-close-btn').focus();
  }

  function stepDrawer(delta) {
    const projects = DATA.projects || [];
    if (!projects.length || activeProjectIndex === -1) return;
    const nextIdx = (activeProjectIndex + delta + projects.length) % projects.length;
    openDrawer(projects[nextIdx].id);
  }

  function closeDrawer() {
    const drawer = document.getElementById('case-drawer');
    const backdrop = document.getElementById('case-drawer-backdrop');
    if (drawer) drawer.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function initSpecimens() {
    const featuredEl = document.getElementById('featured-specimens');
    if (featuredEl && DATA.projects) {
      featuredEl.innerHTML = '';
      DATA.projects
        .filter((p) => p.featured)
        .forEach((p) => featuredEl.appendChild(renderSpecimenCard(p)));
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

      renderGrid();
    }
  }

  /* ------------------------------------------------------------------------
     4. Interactive Naming Pitfalls (/process)
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
        <div class="pitfall-panel">
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
      `;

      const trigger = el.querySelector('.pitfall-trigger');
      trigger.addEventListener('click', () => {
        const isOpen = el.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', String(isOpen));
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
          'Tick any pitfalls you want to guard against—we can carry them straight into your naming brief so we design the decision process around them from day one.';
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

  /* ------------------------------------------------------------------------
     5. Guided 6-Step Naming Brief (/brief)
     ------------------------------------------------------------------------ */
  function initBriefWizard() {
    const wizard = document.getElementById('brief-wizard');
    if (!wizard) return;

    const totalSteps = 6;
    let currentStep = 1;

    const state = {
      audience: '',
      name: '',
      organisation: '',
      email: '',
      projectType: '',
      sector: '',
      context: '',
      avoid: '',
      approvers: '',
      decider: '',
      legalStatus: '',
      territories: '',
      timeline: '',
      pitfalls: '',
      refProject: ''
    };

    // Pre-populate from query params (?pitfalls=... or ?ref=...)
    const params = new URLSearchParams(window.location.search);
    if (params.get('pitfalls')) {
      state.pitfalls = params.get('pitfalls');
      const banner = document.getElementById('brief-prefill-note');
      if (banner) {
        banner.textContent = `Carried over from Process & Pitfalls: ${state.pitfalls}`;
        banner.style.display = 'block';
      }
    }
    if (params.get('ref')) {
      state.refProject = params.get('ref');
      const banner = document.getElementById('brief-prefill-note');
      if (banner) {
        banner.textContent = `Referenced work example: ${state.refProject}`;
        banner.style.display = 'block';
      }
    }

    // Bind choice cards
    wizard.querySelectorAll('[data-choice-group]').forEach((group) => {
      const key = group.getAttribute('data-choice-group');
      group.querySelectorAll('.choice-card').forEach((card) => {
        card.addEventListener('click', () => {
          group.querySelectorAll('.choice-card').forEach((c) => {
            c.classList.remove('is-selected');
            c.setAttribute('aria-pressed', 'false');
          });
          card.classList.add('is-selected');
          card.setAttribute('aria-pressed', 'true');
          state[key] = card.getAttribute('data-value') || '';
        });
      });
    });

    // Bind text inputs
    wizard.querySelectorAll('[data-field]').forEach((input) => {
      const key = input.getAttribute('data-field');
      input.addEventListener('input', () => {
        state[key] = input.value.trim();
      });
    });

    const stepNodes = wizard.querySelectorAll('.brief-step');
    const progressFill = document.getElementById('brief-progress-fill');
    const progressLabel = document.getElementById('brief-progress-label');
    const prevBtn = document.getElementById('brief-prev');
    const nextBtn = document.getElementById('brief-next');
    const asideEyebrow = document.getElementById('aside-eyebrow');
    const asideTitle = document.getElementById('aside-title');
    const asideBody = document.getElementById('aside-body');

    function syncAside(step) {
      const caveat = (DATA.briefCaveats || []).find((c) => c.step === step);
      if (!caveat) return;
      if (asideEyebrow) asideEyebrow.textContent = caveat.eyebrow;
      if (asideTitle) asideTitle.textContent = caveat.title;
      if (asideBody) asideBody.textContent = caveat.body;
    }

    function buildFormattedBrief() {
      const lines = [
        'NAMING BRIEF — Tim Burley (Creating great names)',
        '========================================',
        `Commissioning route: ${state.audience || 'Not specified'}`,
        `Contact: ${state.name || 'Not specified'}${state.organisation ? ' (' + state.organisation + ')' : ''}`,
        `Email: ${state.email || 'Not specified'}`,
        '',
        'PROJECT SCOPE',
        `What we are naming: ${state.projectType || 'Not specified'}`,
        `Sector / market: ${state.sector || 'Not specified'}`,
        state.refProject ? `Referenced work example: ${state.refProject}` : null,
        '',
        'CONTEXT & AMBITION',
        state.context || 'Not specified',
        state.avoid ? `\nNon-starters / things to avoid:\n${state.avoid}` : null,
        '',
        'APPROVAL PIPELINE',
        `Stakeholders / inputs: ${state.approvers || 'Not specified'}`,
        `Final decision-maker: ${state.decider || 'Not specified'}`,
        state.pitfalls ? `Flagged pitfalls to guard against: ${state.pitfalls}` : null,
        '',
        'TRADEMARK & TIMING',
        `Trademark counsel: ${state.legalStatus || 'Not specified'}`,
        `Territories / markets: ${state.territories || 'Not specified'}`,
        `Target timeline: ${state.timeline || 'Not specified'}`
      ];
      return lines.filter((l) => l !== null).join('\n');
    }

    function renderSummary() {
      const box = document.getElementById('brief-summary-box');
      if (!box) return;

      const rows = [
        ['Route & Contact', `${state.audience || '—'} · ${state.name || '—'}${state.organisation ? ' (' + state.organisation + ')' : ''}${state.email ? ' · ' + state.email : ''}`],
        ['What We Are Naming', `${state.projectType || '—'}${state.sector ? ' — ' + state.sector : ''}`],
        ['Context & Ambition', state.context || '—'],
        ['Things to Avoid', state.avoid || 'None noted'],
        ['Approval Pipeline', `Inputs: ${state.approvers || '—'}\nFinal sign-off: ${state.decider || '—'}`],
        ['Trademark & Timing', `Legal partner: ${state.legalStatus || '—'}\nTerritories: ${state.territories || '—'}\nTimeline: ${state.timeline || '—'}`]
      ];

      if (state.pitfalls) {
        rows.push(['Flagged Pitfalls', state.pitfalls]);
      }

      box.innerHTML = rows
        .map(
          ([label, val]) => `
        <div class="brief-summary__row">
          <div class="brief-summary__label">${label}</div>
          <div class="brief-summary__val"></div>
        </div>
      `
        )
        .join('');

      const valEls = box.querySelectorAll('.brief-summary__val');
      rows.forEach(([, val], i) => {
        valEls[i].textContent = val;
      });
    }

    function showStep(step) {
      currentStep = Math.max(1, Math.min(totalSteps, step));
      stepNodes.forEach((node) => {
        const s = Number(node.getAttribute('data-step'));
        node.classList.toggle('is-active', s === currentStep);
      });

      if (progressFill) {
        progressFill.style.width = `${(currentStep / totalSteps) * 100}%`;
      }
      if (progressLabel) {
        progressLabel.textContent = `Step 0${currentStep} of 0${totalSteps}`;
      }
      if (prevBtn) {
        prevBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
      }
      if (nextBtn) {
        nextBtn.style.display = currentStep === totalSteps ? 'none' : 'inline-flex';
        nextBtn.textContent = currentStep === totalSteps - 1 ? 'Review brief →' : 'Continue →';
      }

      syncAside(currentStep);
      if (currentStep === totalSteps) {
        renderSummary();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => showStep(currentStep - 1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => showStep(currentStep + 1));
    }

    // Final step actions
    const copyBtn = document.getElementById('brief-copy');
    const printBtn = document.getElementById('brief-print');
    const emailBtn = document.getElementById('brief-send-email');
    const statusBanner = document.getElementById('brief-status');

    function showStatus(msg) {
      if (!statusBanner) return;
      statusBanner.textContent = msg;
      statusBanner.classList.add('is-visible');
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const text = buildFormattedBrief();
        try {
          await navigator.clipboard.writeText(text);
          showStatus('Brief copied to your clipboard. Paste it into an email or share it with your team.');
        } catch {
          showStatus('Select and copy the brief summary above—clipboard access was restricted by the browser.');
        }
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }

    if (emailBtn) {
      emailBtn.addEventListener('click', () => {
        const email = DATA.contactEmail || 'names@timburley.com';
        const subject = `Naming Brief: ${state.organisation || state.projectType || 'New Enquiry'}`;
        const body = buildFormattedBrief();
        const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
        showStatus(`Opening your email client addressed to ${email} with your structured brief pre-filled.`);
      });
    }

    showStep(1);
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initReveals();
    initSpecimens();
    initPitfalls();
    initBriefWizard();
  });
})();
