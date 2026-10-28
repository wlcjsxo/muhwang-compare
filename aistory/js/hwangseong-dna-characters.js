(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PAGE_SIZE = 30;
  let registry = null;
  let family = 'all';
  let page = 1;

  function installOriginalImageViewer() {
    const selector = '#grid .thumb img, #viewer img';
    const style = document.createElement('style');
    style.textContent = `${selector}{cursor:zoom-in} ${selector}:focus-visible{outline:3px solid #f2c35b;outline-offset:3px}`;
    document.head.appendChild(style);

    const enhance = (root = document) => {
      root.querySelectorAll(selector).forEach((image) => {
        image.tabIndex = 0;
        image.setAttribute('role', 'link');
        image.setAttribute('title', '클릭하면 원본 크기로 새 창에서 엽니다');
        image.setAttribute('aria-label', `${image.alt || '이미지'} - 원본 크기로 열기`);
      });
    };
    const openOriginal = (image) => {
      const source = image.currentSrc || image.src;
      if (!source) return;
      window.open(new URL(source, document.baseURI).href, '_blank', 'noopener,noreferrer');
    };

    document.addEventListener('click', (event) => {
      const image = event.target.closest?.(selector);
      if (!image) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openOriginal(image);
    }, true);
    document.addEventListener('keydown', (event) => {
      const image = event.target.closest?.(selector);
      if (!image || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openOriginal(image);
    }, true);
    new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) enhance(node);
      }));
    }).observe(document.body, {childList:true, subtree:true});
    enhance();
    document.documentElement.dataset.originalImageViewer = 'ready';
  }

  const statusLabels = {APPROVED:'정본 승인', IN_REVIEW:'검수중', REWORK:'재검수'};
  const familyLabels = Object.fromEntries([
    ['all','전체 배우 원장'], ['lead','주연'], ['major_support','준대조연'],
    ['support','조연'], ['minor','단역'], ['ensemble','군상']
  ]);

  function filteredActors() {
    const q = $('#search').value.trim().toLowerCase();
    const status = $('#status-filter').value;
    const age = $('#age-filter').value;
    const archetype = $('#archetype-filter').value;
    return registry.actors.filter((actor) => {
      const haystack = [
        actor.actor_id, actor.actor_name, actor.name_hanja, ...(actor.aliases || []),
        actor.rank_label, actor.actor_logline, actor.identity_hook, actor.performance_range,
        actor.face_dna, actor.archetype,
        ...(actor.castings || []).flatMap((casting) => [casting.work_title, casting.role_name, casting.role_grade])
      ].filter(Boolean).join(' ').toLowerCase();
      return (family === 'all' || actor.family === family) &&
        (!q || haystack.includes(q)) && (!status || actor.status === status) &&
        (!age || actor.age_band === age) && (!archetype || actor.archetype === archetype);
    });
  }

  function updateMetrics() {
    const actors = registry.actors;
    const works = new Set(actors.flatMap((a) => (a.castings || []).map((c) => c.work_id || c.work_title)));
    $('#metric-total').textContent = actors.length;
    $('#metric-dna').textContent = actors.filter((a) => a.dna_approved).length;
    $('#metric-color').textContent = actors.filter((a) => a.color_sheet_url).length;
    $('#metric-ink').textContent = actors.filter((a) => a.ink_sheet_url).length;
    $('#metric-acting').textContent = actors.filter((a) => a.acting_set_approved).length;
    $('#metric-works').textContent = works.size;
    $('#metric-research').textContent = registry.development_refs.length + actors.filter((a) => a.status === 'IN_REVIEW').length;
    $('#metric-rework').textContent = actors.filter((a) => a.status === 'REWORK').length;
    document.querySelectorAll('[data-family]').forEach((button) => {
      const key = button.dataset.family;
      const count = key === 'all' ? actors.length : actors.filter((a) => a.family === key).length;
      const sub = button.querySelector('.tab-sub');
      sub.textContent = `${familyLabels[key]} · ${count}명`;
    });
  }

  function renderDevelopment() {
    $('#development-mount').innerHTML = registry.development_refs.map((item) => `
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
      : `<img loading="lazy" src="${esc(image)}" alt="${esc(actor.actor_name)} 컬러 정본">`;
    return `<article class="card actor-card" data-actor-id="${esc(actor.actor_id)}">
      <div class="thumb ${variants.length > 1 ? 'has-variants' : ''}" data-open-actor="${esc(actor.actor_id)}">${thumbMedia}<span class="badge">${esc(actor.actor_id)}</span><span class="badge auto ${esc(actor.status)}">${esc(statusLabels[actor.status] || actor.status)}</span></div>
      <div class="body"><div class="title-row"><h2>${esc(actor.actor_name)} <small>${esc(actor.name_hanja || '')}</small></h2><span class="actor-status ${esc(actor.status)}">${esc(statusLabels[actor.status] || actor.status)}</span></div>
      <p class="role"><b>${esc(actor.rank_label || '')}</b> · ${esc(actor.actor_logline || '')}</p>
      <div class="dna-brief"><span class="dna-id">PERMANENT ACTOR DNA</span><strong>${esc(actor.identity_hook || '')}</strong><p>${esc(actor.performance_range || '')}</p><dl><dt>원형</dt><dd>${esc(actor.archetype || '미정')}</dd><dt>캐스팅</dt><dd>${(actor.castings || []).length}개 작품</dd></dl></div>
      <div class="links"><a href="#" data-open-actor="${esc(actor.actor_id)}">컬러·먹선·DNA</a></div></div></article>`;
  }

  function renderPager(total, pages) {
    $('#prev-page').disabled = page <= 1;
    $('#next-page').disabled = page >= pages;
    $('#page-buttons').innerHTML = Array.from({length: pages}, (_, i) => `<button type="button" data-page="${i + 1}" class="${page === i + 1 ? 'active' : ''}">${i + 1}</button>`).join('');
    $('#page-info').textContent = `${page} / ${pages} · ${total}명 · 페이지당 ${PAGE_SIZE}명`;
  }

  function render() {
    const actors = filteredActors();
    const pages = Math.max(1, Math.ceil(actors.length / PAGE_SIZE));
    page = Math.min(page, pages);
    const shown = actors.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    $('#registry-message').textContent = `${familyLabels[family]} · 조건에 맞는 승인 배우 ${actors.length}명`;
    $('#grid').innerHTML = shown.length ? shown.map(actorCard).join('') : `<p class="empty"><strong>등록된 황성DNA 배우 정본이 없습니다.</strong><span>빈 원장이 정상입니다. 기존 생성 캐릭터를 채우지 않고, 원작 대조와 사용자 승인을 통과한 배우만 이곳에 등록합니다.</span></p>`;
    renderPager(actors.length, pages);
  }

  function openActor(id) {
    const actor = registry.actors.find((item) => item.actor_id === id);
    if (!actor) return;
    $('#modal-title').textContent = `${actor.actor_name} · ${actor.actor_id}`;
    $('#modal-color').src = actor.color_sheet_url || './aistory/assets/hyeolgyeon-v2/pending-sheet.svg';
    $('#modal-ink').src = actor.ink_sheet_url || './aistory/assets/hyeolgyeon-v2/pending-sheet.svg';
    const history = (actor.castings || []).map((casting) => `<article><strong>${esc(casting.work_title)}</strong><p>${esc(casting.role_grade || actor.rank_label || '')} · ${esc(casting.role_name)} · 출연 ${esc((casting.volumes || []).join(', '))}권</p></article>`).join('') || '<p>아직 작품 출연 이력이 없습니다.</p>';
    const variants = actor.appearance_variants || [];
    const variantGallery = variants.length > 1 ? `<section class="appearance-variants"><div class="variant-heading"><span class="dna-kicker">CHARACTER APPEARANCE ARCHIVE</span><h3>시대별 캐릭터 시트 ${variants.length}종</h3></div><div class="variant-detail-grid">${variants.map((variant) => `<article><div class="variant-pair"><figure><img loading="lazy" src="${esc(variant.color_sheet_url)}" alt="${esc(actor.actor_name)} ${esc(variant.label)} 컬러 정본"><figcaption>컬러 정본</figcaption></figure><figure><img loading="lazy" src="${esc(variant.ink_sheet_url)}" alt="${esc(actor.actor_name)} ${esc(variant.label)} 원작 먹선"><figcaption>원작 식별 근거</figcaption></figure></div><h4>${esc(variant.label)}</h4><p>${esc(variant.face_dna || '')}</p><p class="variant-scope">등장 권: ${esc((variant.volume_scope || []).map((v) => `${v}권`).join(' · '))}</p></article>`).join('')}</div></section>` : '';
    $('#modal-dna').innerHTML = `<header><span class="dna-kicker">${esc(actor.actor_id)} · CHARACTER PROFILE</span><h2>${esc(actor.actor_name)} <small>${esc(actor.name_hanja || '')}</small></h2><p class="dna-alias">${esc((actor.aliases || []).join(' · '))}</p><blockquote>${esc(actor.actor_logline || '')}</blockquote></header>${variantGallery}<div class="dna-columns"><section><h3>외형 특징</h3><p>${esc(actor.face_dna || '')}</p></section><section><h3>캐릭터 특징</h3><p>${esc(actor.performance_range || '')}</p></section></div><h3>작품별 출연 이력</h3><div class="casting-history">${history}</div>`;
    $('#viewer').showModal();
  }

  document.addEventListener('click', (event) => {
    const familyButton = event.target.closest('[data-family]');
    const pageButton = event.target.closest('[data-page]');
    const actorButton = event.target.closest('[data-open-actor]');
    if (familyButton) { family = familyButton.dataset.family; page = 1; document.querySelectorAll('[data-family]').forEach((button) => button.classList.toggle('active', button === familyButton)); render(); }
    if (pageButton) { page = Number(pageButton.dataset.page); render(); }
    if (actorButton) { event.preventDefault(); openActor(actorButton.dataset.openActor); }
  });
  installOriginalImageViewer();
  ['search','status-filter','age-filter','archetype-filter'].forEach((id) => $('#' + id).addEventListener(id === 'search' ? 'input' : 'change', () => { page = 1; render(); }));
  $('#prev-page').addEventListener('click', () => { if (page > 1) { page--; render(); } });
  $('#next-page').addEventListener('click', () => { page++; render(); });
  $('#close-modal').addEventListener('click', () => $('#viewer').close());
  $('#viewer').addEventListener('click', (event) => { if (event.target === $('#viewer')) $('#viewer').close(); });

  fetch('./aistory/data/hwangseong-dna-actors.json?v=public-scrub-20261028', {cache:'no-store'})
    .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
    .then((data) => { registry = data; updateMetrics(); renderDevelopment(); render(); $('#registry-status').textContent = `● 공개 캐릭터 아카이브 · ${data.actors.length}명`; })
    .catch((error) => { $('#registry-message').textContent = `캐릭터 아카이브 로딩 실패: ${error.message}`; $('#grid').innerHTML = '<p class="empty">캐릭터 자료를 불러오지 못했습니다.</p>'; });
})();
