(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PAGE_SIZE = 30;
  const fallback = './aistory/assets/public-placeholders/character-unavailable.svg';
  const familyLabels = {all:'전체 배우 원장', lead:'주연', major_support:'준대조연', support:'조연', minor:'단역', ensemble:'군상'};
  let registry = null, family = 'all', page = 1;

  function filteredActors() {
    const q = $('#search')?.value.trim().toLowerCase() || '';
    return (registry?.actors || []).filter((actor) => {
      const haystack = [actor.actor_id, actor.actor_name, actor.name_hanja, ...(actor.aliases || []), actor.rank_label,
        ...(actor.castings || []).flatMap((casting) => [casting.work_title, casting.role_name, casting.role_grade, ...(casting.volumes || [])])]
        .filter(Boolean).join(' ').toLowerCase();
      return (family === 'all' || actor.family === family) && (!q || haystack.includes(q));
    });
  }

  function updateMetrics() {
    const actors = registry.actors || [];
    const works = new Set(actors.flatMap((actor) => (actor.castings || []).map((casting) => casting.work_title)).filter(Boolean));
    $('#metric-total').textContent = actors.length;
    $('#metric-color').textContent = actors.filter((actor) => actor.color_sheet_url).length;
    $('#metric-ink').textContent = actors.filter((actor) => actor.ink_sheet_url).length;
    $('#metric-works').textContent = works.size;
    $('#metric-lead').textContent = actors.filter((actor) => actor.family === 'lead').length;
    $('#metric-support').textContent = actors.filter((actor) => ['major_support','support'].includes(actor.family)).length;
    $('#metric-minor').textContent = actors.filter((actor) => actor.family === 'minor').length;
    $('#metric-ensemble').textContent = actors.filter((actor) => actor.family === 'ensemble').length;
    document.querySelectorAll('[data-family]').forEach((button) => {
      const key = button.dataset.family;
      const count = key === 'all' ? actors.length : actors.filter((actor) => actor.family === key).length;
      button.querySelector('.tab-sub').textContent = `${familyLabels[key] || key} · ${count}배역 단위`;
    });
  }

  function publicCasting(actor) {
    const casting = actor.castings?.[0];
    if (!casting) return '출연 정보 없음';
    const volumes = casting.volumes?.length ? ` · ${casting.volumes.join(', ')}권` : '';
    return `${casting.work_title || ''} · ${casting.role_name || actor.actor_name}${volumes}`;
  }

  function actorCard(actor) {
    const variants = actor.appearance_variants || [];
    const media = variants.length > 1
      ? `<div class="variant-card-images">${variants.map((variant) => `<figure><img loading="eager" decoding="async" src="${esc(variant.color_sheet_url || fallback)}" alt="${esc(actor.actor_name)} ${esc(variant.label)}"><figcaption>${esc(variant.label)}</figcaption></figure>`).join('')}</div>`
      : `<img loading="eager" decoding="async" src="${esc(actor.color_sheet_url || fallback)}" alt="${esc(actor.actor_name)} 컬러 이미지">`;
    return `<article class="card actor-card" data-actor-id="${esc(actor.actor_id)}">
      <div class="thumb ${variants.length > 1 ? 'has-variants' : ''}" data-open-actor="${esc(actor.actor_id)}">${media}<span class="badge">${esc(actor.actor_id)}</span></div>
      <div class="body"><div class="title-row"><h2>${esc(actor.actor_name)} <small>${esc(actor.name_hanja || '')}</small></h2></div>
      <p class="role"><b>${esc(actor.rank_label || '')}</b> · ${esc(publicCasting(actor))}</p>
      <div class="links"><a href="#" data-open-actor="${esc(actor.actor_id)}">컬러·먹선 이미지와 출연 이력</a></div></div>
    </article>`;
  }

  function render() {
    const list = filteredActors();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(Math.max(page, 1), totalPages);
    const items = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    $('#registry-message').textContent = `${familyLabels[family] || family} · 공개 캐릭터 ${list.length}배역 단위`;
    $('#grid').innerHTML = items.length ? items.map(actorCard).join('') : '<p class="empty"><strong>조건에 맞는 캐릭터가 없습니다.</strong></p>';
    $('#page-info').textContent = `${page} / ${totalPages} (총 ${list.length}배역 단위)`;
    $('#page-buttons').innerHTML = Array.from({length:totalPages}, (_, index) => `<button type="button" class="pager-btn ${page === index + 1 ? 'active' : ''}" data-page="${index + 1}">${index + 1}</button>`).join('');
    $('#prev-page').disabled = page <= 1;
    $('#next-page').disabled = page >= totalPages;
  }

  function openActor(actorId) {
    const actor = registry.actors.find((item) => item.actor_id === actorId);
    if (!actor) return;
    $('#modal-title').textContent = `${actor.actor_name} (${actor.actor_id})`;
    $('#modal-color').src = actor.color_sheet_url || fallback;
    $('#modal-ink').src = actor.ink_sheet_url || fallback;
    const variants = actor.appearance_variants || [];
    const variantGallery = variants.length > 1 ? `<section class="appearance-variants"><div class="variant-heading"><h3>공개 외형 이미지 ${variants.length}종</h3></div><div class="variant-detail-grid">${variants.map((variant) => `<article><div class="variant-pair"><figure><img loading="lazy" src="${esc(variant.color_sheet_url || fallback)}" alt="${esc(actor.actor_name)} ${esc(variant.label)} 컬러"><figcaption>컬러 이미지</figcaption></figure><figure><img loading="lazy" src="${esc(variant.ink_sheet_url || fallback)}" alt="${esc(actor.actor_name)} ${esc(variant.label)} 먹선"><figcaption>먹선 이미지</figcaption></figure></div><h4>${esc(variant.label)}</h4></article>`).join('')}</div></section>` : '';
    const history = (actor.castings || []).map((casting) => `<article><strong>${esc(casting.work_title || '')}</strong><p>${esc(casting.role_grade || actor.rank_label || '')} · ${esc(casting.role_name || actor.actor_name)}${casting.volumes?.length ? ` · 출연 ${esc(casting.volumes.join(', '))}권` : ''}</p></article>`).join('') || '<p>공개된 출연 이력이 없습니다.</p>';
    $('#modal-dna').innerHTML = `<header><span class="dna-kicker">${esc(actor.actor_id)} · PUBLIC CHARACTER GALLERY</span><h2>${esc(actor.actor_name)} <small>${esc(actor.name_hanja || '')}</small></h2><p class="dna-alias">${esc((actor.aliases || []).join(' · '))}</p></header>${variantGallery}<h3>작품별 출연 이력</h3><div class="casting-history">${history}</div>`;
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
  $('#search')?.addEventListener('input', () => { page = 1; render(); });
  $('#prev-page')?.addEventListener('click', () => { if (page > 1) { page--; render(); } });
  $('#next-page')?.addEventListener('click', () => { page++; render(); });
  $('#close-modal')?.addEventListener('click', () => $('#viewer').close());
  $('#viewer')?.addEventListener('click', (event) => { if (event.target === $('#viewer')) $('#viewer').close(); });

  fetch('./aistory/data/haseungnam-dna-actors.json?v=public-gallery-41-20261028', {cache:'no-store'})
    .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
    .then((data) => { registry = data; updateMetrics(); render(); $('#registry-status').textContent = `● 하승남 공개 캐릭터 갤러리 · ${data.actors.length}배역 단위`; })
    .catch((error) => { $('#registry-message').textContent = `캐릭터 갤러리 로딩 실패: ${error.message}`; $('#grid').innerHTML = '<p class="empty">캐릭터 자료를 불러오지 못했습니다.</p>'; });
})();
