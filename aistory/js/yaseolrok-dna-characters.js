(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PAGE_SIZE = 30;
  let registry = null;
  let family = 'all';
  let page = 1;

  const statusLabels = { COLOR_APPROVED: '컬러 검수통과', APPROVED: '정본 승인', IN_REVIEW: '검수중', REWORK: '재검수' };
  const familyLabels = Object.fromEntries([
    ['all', '전체 배우 원장'], ['lead', '주연'], ['major_support', '준대조연'],
    ['support', '조연'], ['minor', '단역'], ['ensemble', '군상']
  ]);

  function filteredActors() {
    if (!registry || !registry.actors) return [];
    const q = $('#search')?.value.trim().toLowerCase() || '';
    const status = $('#status-filter')?.value || '';
    const age = $('#age-filter')?.value || '';
    const archetype = $('#archetype-filter')?.value || '';

    return registry.actors.filter((actor) => {
      const haystack = JSON.stringify(actor).toLowerCase();
      return (family === 'all' || actor.family === family) &&
        (!q || haystack.includes(q)) && (!status || actor.status === status) &&
        (!age || actor.age_band === age) && (!archetype || actor.archetype === archetype);
    });
  }

  function updateMetrics() {
    const actors = registry.actors || [];
    const works = new Set(actors.flatMap((a) => (a.castings || []).map((c) => c.work_id || c.work_title)));
    if ($('#metric-total')) $('#metric-total').textContent = actors.length;
    if ($('#metric-dna')) $('#metric-dna').textContent = actors.filter((a) => a.dna_approved).length;
    if ($('#metric-color')) $('#metric-color').textContent = actors.filter((a) => a.color_sheet_url).length;
    if ($('#metric-ink')) $('#metric-ink').textContent = actors.filter((a) => a.ink_sheet_url).length;
    if ($('#metric-acting')) $('#metric-acting').textContent = actors.filter((a) => a.acting_set_approved).length;
    if ($('#metric-works')) $('#metric-works').textContent = works.size;
    if ($('#metric-research')) $('#metric-research').textContent = (registry.development_refs || []).length + actors.filter((a) => a.status === 'IN_REVIEW').length;
    if ($('#metric-rework')) $('#metric-rework').textContent = actors.filter((a) => a.status === 'REWORK').length;

    document.querySelectorAll('[data-family]').forEach((button) => {
      const key = button.dataset.family;
      const count = key === 'all' ? actors.length : actors.filter((a) => a.family === key).length;
      const sub = button.querySelector('.tab-sub');
      if (sub) sub.textContent = `${familyLabels[key] || key} · ${count}배역 단위`;
    });
  }

  function renderDevelopment() {
    const devMount = $('#development-mount');
    if (!devMount) return;
    const refs = registry.development_refs || [];
    if (refs.length === 0) {
      devMount.innerHTML = '';
      return;
    }
    devMount.innerHTML = refs.map((item) => `
      <article class="development-card">
        <div><span class="dev-kicker">${esc(item.development_id)} · DEVELOPMENT REFERENCE</span><h2>${esc(item.name)}</h2></div>
        <p>${esc(item.summary)}<br><b>정본 미등록 사유:</b> ${esc(item.reason)}</p>
        <div><span class="dev-state">${esc(item.status_label)}</span><a class="hub-link" href="${esc(item.reference_url)}" style="display:block;margin-top:9px;text-align:center">장면 참고 열기</a></div>
      </article>`).join('');
  }

  function actorCard(actor) {
    const image = actor.color_sheet_url || './aistory/assets/hyeolgyeon-v2/pending-sheet.svg';
    const variants = actor.appearance_variants || [];
    const thumbMedia = variants.length > 1
      ? `<div class="variant-card-images">${variants.map((variant) => `<figure><img loading="lazy" src="${esc(variant.color_sheet_url)}" alt="${esc(actor.actor_name)} ${esc(variant.label)}"><figcaption>${esc(variant.label)}</figcaption></figure>`).join('')}</div>`
      : `<img loading="lazy" src="${esc(image)}" alt="${esc(actor.actor_name)} ${actor.color_approved ? '컬러 검수통과' : (actor.status === 'APPROVED' ? '컬러 정본' : '컬러 제작본 검수중')}">`;

    return `<article class="card actor-card" data-actor-id="${esc(actor.actor_id)}">
      <div class="thumb ${variants.length > 1 ? 'has-variants' : ''}" data-open-actor="${esc(actor.actor_id)}">${thumbMedia}<span class="badge">${esc(actor.actor_id)}</span><span class="badge auto ${esc(actor.status)}">${esc(statusLabels[actor.status] || actor.status)}</span></div>
      <div class="body"><div class="title-row"><h2>${esc(actor.actor_name)} <small>${esc(actor.name_hanja || '')}</small></h2><span class="actor-status ${esc(actor.status)}">${esc(statusLabels[actor.status] || actor.status)}</span></div>
      <p class="role"><b>${esc(actor.rank_label || '')}</b> · ${esc(actor.actor_logline || '')}</p>
      <div class="dna-brief"><span class="dna-id">YA SEOL-ROK PERMANENT DNA</span><strong>${esc(actor.identity_hook || '')}</strong><p>${esc(actor.performance_range || '')}</p><dl><dt>원형</dt><dd>${esc(actor.archetype || '미정')}</dd><dt>캐스팅</dt><dd>${(actor.castings || []).length}건의 배역 이력</dd></dl></div>
      <div class="links"><a href="#" data-open-actor="${esc(actor.actor_id)}">컬러·먹선·DNA</a> · <a href="${esc(actor.castings?.[0]?.comparison_url || '#')}">원작 대조</a> · <a href="${esc(actor.prompt_provenance?.metadata_url || '#')}">제작 기록</a></div></div></article>`;
  }

  function render() {
    const list = filteredActors();
    const grid = $('#grid');
    if (!grid) return;

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty">
          <strong style="color:var(--gold); font-size:22px; margin-bottom:8px;">야설록DNA 배우 원장 · 전권 제작 진행</strong>
          <span style="color:var(--muted); max-width:540px; line-height:1.6;">
            현재 야설록 화실(도지산검지림 21권)의 배우 원장 껍데기 틀이 깨끗하게 생성되었습니다.<br>
            원작 4,429쪽에서 추출한 8등신 극화 캐릭터 정본(군악 등)을 등록하면 이곳에 자동으로 실시간 등재됩니다.
          </span>
        </div>
      `;
      $('#page-info').textContent = '0 / 0';
      $('#page-buttons').innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(list.length / PAGE_SIZE) || 1;
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;

    const start = (page - 1) * PAGE_SIZE;
    const pageItems = list.slice(start, start + PAGE_SIZE);

    grid.innerHTML = pageItems.map(actorCard).join('');
    $('#page-info').textContent = `${page} / ${totalPages} (총 ${list.length}배역 단위)`;

    let btnHtml = '';
    for (let p = 1; p <= totalPages; p++) {
      btnHtml += `<button type="button" class="pager-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    $('#page-buttons').innerHTML = btnHtml;
  }

  function openActor(actorId) {
    const actor = (registry.actors || []).find((a) => a.actor_id === actorId);
    if (!actor) return;

    $('#modal-title').textContent = `${actor.actor_name} (${actor.actor_id}) - 야설록DNA 배우 상세`;
    $('#modal-color').src = actor.color_sheet_url || './aistory/assets/hyeolgyeon-v2/pending-sheet.svg';
    $('#modal-ink').src = actor.ink_sheet_url || './aistory/assets/hyeolgyeon-v2/pending-sheet.svg';

    $('#modal-dna').innerHTML = `
      <div style="padding:12px;">
        <h3 style="color:var(--gold);">${esc(actor.actor_name)} <small>${esc(actor.name_hanja || '')}</small></h3>
        <p style="color:#e2e8f0;"><b>성격/외양:</b> ${esc(actor.identity_hook || '')}</p>
        <p style="color:var(--muted);">${esc(actor.performance_range || '')}</p>
      </div>
    `;
    $('#viewer').showModal();
  }

  // Event Listeners
  document.addEventListener('click', (event) => {
    const familyButton = event.target.closest('[data-family]');
    const pageButton = event.target.closest('[data-page]');
    const actorButton = event.target.closest('[data-open-actor]');

    if (familyButton) {
      family = familyButton.dataset.family;
      page = 1;
      document.querySelectorAll('[data-family]').forEach((b) => b.classList.toggle('active', b === familyButton));
      render();
    }
    if (pageButton) {
      page = Number(pageButton.dataset.page);
      render();
    }
    if (actorButton) {
      event.preventDefault();
      openActor(actorButton.dataset.openActor);
    }
  });

  ['search', 'status-filter', 'age-filter', 'archetype-filter'].forEach((id) => {
    const el = $('#' + id);
    if (el) el.addEventListener(id === 'search' ? 'input' : 'change', () => { page = 1; render(); });
  });

  $('#prev-page')?.addEventListener('click', () => { if (page > 1) { page--; render(); } });
  $('#next-page')?.addEventListener('click', () => { page++; render(); });
  $('#close-modal')?.addEventListener('click', () => $('#viewer').close());
  $('#viewer')?.addEventListener('click', (e) => { if (e.target === $('#viewer')) $('#viewer').close(); });

  $('#export')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(registry, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'yaseolrok-dna-actor-registry.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  // Fetch JSON
  fetch('./aistory/data/yaseolrok-dna-actors.json?v=skeleton-20261026', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      registry = data;
      updateMetrics();
      renderDevelopment();
      render();
      if ($('#registry-status')) $('#registry-status').textContent = `● ${data.schema} · ${data.version}`;
      if ($('#registry-message')) $('#registry-message').textContent = `야설록DNA 배우 원장 · 제작중 배역 포함 · 사용자 승인 별도`;
    })
    .catch((err) => {
      console.error(err);
      if ($('#registry-message')) $('#registry-message').textContent = `배우 원장 로딩 실패: ${err.message}`;
      if ($('#grid')) $('#grid').innerHTML = '<p class="empty">배우 원장을 불러오지 못했습니다.</p>';
    });
})();
