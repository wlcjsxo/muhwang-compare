(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PAGE_SIZE = 30;
  const fallback = './aistory/assets/public-placeholders/character-unavailable.svg';
  let registry = null;
  let family = 'all';
  let page = 1;

  const statusLabels = {COLOR_APPROVED:'컬러 검수통과', APPROVED:'정본 승인', IN_REVIEW:'검수중', REWORK:'재검수'};
  const familyLabels = {all:'전체 배우 원장', lead:'주연', major_support:'준대조연', support:'조연', minor:'단역', ensemble:'군상'};

  function filteredActors() {
    if (!registry?.actors) return [];
    const q = $('#search')?.value.trim().toLowerCase() || '';
    const status = $('#status-filter')?.value || '';
    const age = $('#age-filter')?.value || '';
    const archetype = $('#archetype-filter')?.value || '';
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
    const actors = registry.actors || [];
    const works = new Set(actors.flatMap((a) => (a.castings || []).map((c) => c.work_id || c.work_title)).filter(Boolean));
    $('#metric-total').textContent = actors.length;
    $('#metric-dna').textContent = actors.filter((a) => a.dna_approved).length;
    $('#metric-color').textContent = actors.filter((a) => a.color_sheet_url).length;
    $('#metric-ink').textContent = actors.filter((a) => a.ink_sheet_url).length;
    $('#metric-acting').textContent = actors.filter((a) => a.acting_set_approved).length;
    $('#metric-works').textContent = works.size;
    $('#metric-research').textContent = actors.filter((a) => a.status === 'IN_REVIEW').length;
    $('#metric-rework').textContent = actors.filter((a) => a.status === 'REWORK').length;
    document.querySelectorAll('[data-family]').forEach((button) => {
      const key = button.dataset.family;
      const count = key === 'all' ? actors.length : actors.filter((a) => a.family === key).length;
      const sub = button.querySelector('.tab-sub');
      if (sub) sub.textContent = `${familyLabels[key] || key} · ${count}배역 단위`;
    });
  }

  function actorCard(actor) {
    const image = actor.color_sheet_url || fallback;
    const variants = actor.appearance_variants || [];
    const thumbMedia = variants.length > 1
      ? `<div class="variant-card-images">${variants.map((variant) => `<figure><img loading="eager" decoding="async" src="${esc(variant.color_sheet_url || fallback)}" alt="${esc(actor.actor_name)} ${esc(variant.label)}"><figcaption>${esc(variant.label)}</figcaption></figure>`).join('')}</div>`
      : `<img loading="eager" decoding="async" src="${esc(image)}" alt="${esc(actor.actor_name)} ${actor.color_approved ? '컬러 검수통과' : (actor.status === 'APPROVED' ? '컬러 정본' : '컬러 제작본 검수중')}">`;
    return `<article class="card actor-card" data-actor-id="${esc(actor.actor_id)}">
      <div class="thumb ${variants.length > 1 ? 'has-variants' : ''}" data-open-actor="${esc(actor.actor_id)}">${thumbMedia}<span class="badge">${esc(actor.actor_id)}</span><span class="badge auto ${esc(actor.status)}">${esc(statusLabels[actor.status] || actor.status)}</span></div>
      <div class="body"><div class="title-row"><h2>${esc(actor.actor_name)} <small>${esc(actor.name_hanja || '')}</small></h2><span class="actor-status ${esc(actor.status)}">${esc(statusLabels[actor.status] || actor.status)}</span></div>
      <p class="role"><b>${esc(actor.rank_label || '')}</b> · ${esc(actor.actor_logline || '')}</p>
      <div class="dna-brief"><span class="dna-id">YA SEOL-ROK PERMANENT DNA</span><strong>${esc(actor.identity_hook || '')}</strong><p>${esc(actor.performance_range || '')}</p><dl><dt>원형</dt><dd>${esc(actor.archetype || '미정')}</dd><dt>캐스팅</dt><dd>${(actor.castings || []).length}건의 배역 이력</dd></dl></div>
      <div class="links"><a href="#" data-open-actor="${esc(actor.actor_id)}">컬러·먹선·DNA</a></div></div></article>`;
  }

  function render() {
    const list = filteredActors();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(Math.max(page, 1), totalPages);
    const pageItems = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    $('#registry-message').textContent = `${familyLabels[family] || family} · 공개 캐릭터 ${list.length}배역 단위`;
    $('#grid').innerHTML = pageItems.length ? pageItems.map(actorCard).join('') : '<p class="empty"><strong>조건에 맞는 배우가 없습니다.</strong></p>';
    $('#page-info').textContent = `${page} / ${totalPages} (총 ${list.length}배역 단위)`;
    $('#page-buttons').innerHTML = Array.from({length:totalPages}, (_, i) => `<button type="button" class="pager-btn ${page === i + 1 ? 'active' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('');
    $('#prev-page').disabled = page <= 1;
    $('#next-page').disabled = page >= totalPages;
  }

  function openActor(actorId) {
    const actor = (registry.actors || []).find((item) => item.actor_id === actorId);
    if (!actor) return;
    $('#modal-title').textContent = `${actor.actor_name} (${actor.actor_id}) - 야설록DNA 배우 상세`;
    $('#modal-color').src = actor.color_sheet_url || fallback;
    $('#modal-ink').src = actor.ink_sheet_url || fallback;
    const history = (actor.castings || []).map((casting) => `<article><strong>${esc(casting.work_title || '')}</strong><p>${esc(casting.role_grade || actor.rank_label || '')} · ${esc(casting.role_name || actor.actor_name)}${casting.volumes?.length ? ` · 출연 ${esc(casting.volumes.join(', '))}권` : ''}</p></article>`).join('') || '<p>공개된 출연 이력이 없습니다.</p>';
    const variants = actor.appearance_variants || [];
    const variantGallery = variants.length > 1 ? `<section class="appearance-variants"><div class="variant-heading"><span class="dna-kicker">CHARACTER APPEARANCE ARCHIVE</span><h3>시대별 캐릭터 시트 ${variants.length}종</h3></div><div class="variant-detail-grid">${variants.map((variant) => `<article><div class="variant-pair"><figure><img loading="lazy" src="${esc(variant.color_sheet_url || fallback)}" alt="${esc(actor.actor_name)} ${esc(variant.label)} 컬러"><figcaption>컬러 참고/제작본</figcaption></figure><figure><img loading="lazy" src="${esc(variant.ink_sheet_url || fallback)}" alt="${esc(actor.actor_name)} ${esc(variant.label)} 먹선"><figcaption>원작/먹선 참고</figcaption></figure></div><h4>${esc(variant.label)}</h4><p>${esc(variant.face_dna || '')}</p></article>`).join('')}</div></section>` : '';
    $('#modal-dna').innerHTML = `<header><span class="dna-kicker">${esc(actor.actor_id)} · YA SEOL-ROK CHARACTER PROFILE</span><h2>${esc(actor.actor_name)} <small>${esc(actor.name_hanja || '')}</small></h2><p class="dna-alias">${esc((actor.aliases || []).join(' · '))}</p><blockquote>${esc(actor.actor_logline || '')}</blockquote></header>${variantGallery}<div class="dna-columns"><section><h3>외형 특징</h3><p>${esc(actor.face_dna || actor.identity_hook || '')}</p></section><section><h3>연기 범위</h3><p>${esc(actor.performance_range || '')}</p></section></div><h3>작품별 출연 이력</h3><div class="casting-history">${history}</div>`;
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
  ['search','status-filter','age-filter','archetype-filter'].forEach((id) => $('#' + id)?.addEventListener(id === 'search' ? 'input' : 'change', () => { page = 1; render(); }));
  $('#prev-page')?.addEventListener('click', () => { if (page > 1) { page--; render(); } });
  $('#next-page')?.addEventListener('click', () => { page++; render(); });
  $('#close-modal')?.addEventListener('click', () => $('#viewer').close());
  $('#viewer')?.addEventListener('click', (event) => { if (event.target === $('#viewer')) $('#viewer').close(); });

  fetch('./aistory/data/yaseolrok-dna-actors.json?v=public-original-20261028', {cache:'no-store'})
    .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
    .then((data) => { registry = data; updateMetrics(); render(); $('#registry-status').textContent = `● 야설록 독립 배우 원장 · ${data.actors.length}배역 단위`; })
    .catch((error) => { $('#registry-message').textContent = `배우 원장 로딩 실패: ${error.message}`; $('#grid').innerHTML = '<p class="empty">배우 원장을 불러오지 못했습니다.</p>'; });
})();
