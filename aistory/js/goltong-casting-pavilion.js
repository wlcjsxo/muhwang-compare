(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PAGE_SIZE = 30;
  const body = document.body.dataset;
  const archiveName = body.archiveName || '공개 캐릭터 아카이브';
  const registryUrl = body.registryUrl;
  const dnaLabel = body.dnaLabel || 'CHARACTER PROFILE';
  const fallback = './aistory/assets/public-placeholders/character-unavailable.svg';
  let registry = null, family = 'all', page = 1;
  const statusLabels = {APPROVED:'승인', IN_REVIEW:'검수중', REWORK:'재검수'};
  const familyLabels = {all:'전체 캐릭터', lead:'주연', major_support:'준대조연', support:'조연', minor:'단역', ensemble:'군상'};
  const text = (value) => Array.isArray(value) ? value.join(' · ') : String(value || '');

  function filteredActors() {
    const q = $('#search').value.trim().toLowerCase();
    const status = $('#status-filter').value, age = $('#age-filter').value, archetype = $('#archetype-filter').value;
    return registry.actors.filter((actor) => {
      const haystack = [actor.actor_id, actor.actor_name, actor.name_hanja, ...(actor.aliases || []), actor.rank_label, actor.actor_logline, actor.identity_hook, text(actor.performance_range), text(actor.face_dna), actor.archetype, ...(actor.castings || []).flatMap((casting) => [casting.work_title, casting.role_name, casting.role_grade])].filter(Boolean).join(' ').toLowerCase();
      return (family === 'all' || actor.family === family) && (!q || haystack.includes(q)) && (!status || actor.status === status) && (!age || actor.age_band === age) && (!archetype || actor.archetype === archetype);
    });
  }
  function updateMetrics() {
    const actors = registry.actors;
    const works = new Set(actors.flatMap((a) => (a.castings || []).map((c) => c.work_id || c.work_title)).filter(Boolean));
    $('#metric-total').textContent = actors.length;
    $('#metric-dna').textContent = actors.filter((a) => a.dna_approved).length;
    $('#metric-color').textContent = actors.filter((a) => a.color_sheet_url).length;
    $('#metric-ink').textContent = actors.filter((a) => a.ink_sheet_url).length;
    $('#metric-acting').textContent = actors.filter((a) => a.acting_set_approved).length;
    $('#metric-works').textContent = works.size;
    $('#metric-research').textContent = actors.filter((a) => a.status === 'IN_REVIEW').length;
    $('#metric-rework').textContent = actors.filter((a) => a.status === 'REWORK').length;
    document.querySelectorAll('[data-family]').forEach((button) => { const key = button.dataset.family; const count = key === 'all' ? actors.length : actors.filter((a) => a.family === key).length; button.querySelector('.tab-sub').textContent = (familyLabels[key] || key) + ' · ' + count + '명'; });
  }
  function actorCard(actor) {
    const image = actor.color_sheet_url || fallback;
    return '<article class="card actor-card" data-actor-id="' + esc(actor.actor_id) + '"><div class="thumb" data-open-actor="' + esc(actor.actor_id) + '"><img loading="lazy" src="' + esc(image) + '" alt="' + esc(actor.actor_name) + ' 공개 이미지"><span class="badge">' + esc(actor.actor_id) + '</span><span class="badge auto ' + esc(actor.status) + '">' + esc(statusLabels[actor.status] || actor.status) + '</span></div><div class="body"><div class="title-row"><h2>' + esc(actor.actor_name) + ' <small>' + esc(actor.name_hanja || '') + '</small></h2><span class="actor-status ' + esc(actor.status) + '">' + esc(statusLabels[actor.status] || actor.status) + '</span></div><p class="role"><b>' + esc(actor.rank_label || '') + '</b> · ' + esc(actor.actor_logline || '') + '</p><div class="dna-brief"><span class="dna-id">' + esc(dnaLabel) + '</span><strong>' + esc(actor.identity_hook || '') + '</strong><p>' + esc(text(actor.performance_range)) + '</p><dl><dt>원형</dt><dd>' + esc(actor.archetype || '미정') + '</dd><dt>출연</dt><dd>' + (actor.castings || []).length + '건</dd></dl></div><div class="links"><a href="#" data-open-actor="' + esc(actor.actor_id) + '">캐릭터 상세</a></div></div></article>';
  }
  function renderPager(total, pages) { $('#prev-page').disabled = page <= 1; $('#next-page').disabled = page >= pages; $('#page-buttons').innerHTML = Array.from({length: pages}, (_, i) => '<button type="button" data-page="' + (i + 1) + '" class="' + (page === i + 1 ? 'active' : '') + '">' + (i + 1) + '</button>').join(''); $('#page-info').textContent = page + ' / ' + pages + ' · ' + total + '명'; }
  function render() { const actors = filteredActors(), pages = Math.max(1, Math.ceil(actors.length / PAGE_SIZE)); page = Math.min(page, pages); const shown = actors.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE); $('#registry-message').textContent = (familyLabels[family] || family) + ' · 공개 캐릭터 ' + actors.length + '명'; $('#grid').innerHTML = shown.length ? shown.map(actorCard).join('') : '<p class="empty"><strong>조건에 맞는 공개 캐릭터가 없습니다.</strong></p>'; renderPager(actors.length, pages); }
  function openActor(id) {
    const actor = registry.actors.find((item) => item.actor_id === id); if (!actor) return;
    $('#modal-title').textContent = actor.actor_name + ' · ' + actor.actor_id;
    $('#modal-color').src = actor.color_sheet_url || fallback;
    const ink = $('#modal-ink'); ink.src = actor.ink_sheet_url || fallback; ink.hidden = !actor.ink_sheet_url;
    const history = (actor.castings || []).map((casting) => '<article><strong>' + esc(casting.work_title) + '</strong><p>' + esc(casting.role_grade || actor.rank_label || '') + ' · ' + esc(casting.role_name) + (casting.volumes?.length ? ' · 출연 ' + esc(casting.volumes.join(', ')) + '권' : '') + '</p></article>').join('') || '<p>공개된 출연 이력이 없습니다.</p>';
    $('#modal-dna').innerHTML = '<header><span class="dna-kicker">' + esc(actor.actor_id) + ' · PUBLIC CHARACTER PROFILE</span><h2>' + esc(actor.actor_name) + ' <small>' + esc(actor.name_hanja || '') + '</small></h2><p class="dna-alias">' + esc((actor.aliases || []).join(' · ')) + '</p><blockquote>' + esc(actor.actor_logline || '') + '</blockquote></header><div class="dna-columns"><section><h3>외형 특징</h3><p>' + esc(text(actor.face_dna) || actor.identity_hook || '') + '</p></section><section><h3>캐릭터 특징</h3><p>' + esc(text(actor.performance_range)) + '</p></section></div><h3>작품별 출연 이력</h3><div class="casting-history">' + history + '</div>';
    $('#viewer').showModal();
  }
  document.addEventListener('click', (event) => { const familyButton = event.target.closest('[data-family]'), pageButton = event.target.closest('[data-page]'), actorButton = event.target.closest('[data-open-actor]'); if (familyButton) { family = familyButton.dataset.family; page = 1; document.querySelectorAll('[data-family]').forEach((button) => button.classList.toggle('active', button === familyButton)); render(); } if (pageButton) { page = Number(pageButton.dataset.page); render(); } if (actorButton) { event.preventDefault(); openActor(actorButton.dataset.openActor); } });
  ['search','status-filter','age-filter','archetype-filter'].forEach((id) => $('#' + id).addEventListener(id === 'search' ? 'input' : 'change', () => { page = 1; render(); }));
  $('#prev-page').addEventListener('click', () => { if (page > 1) { page--; render(); } }); $('#next-page').addEventListener('click', () => { page++; render(); }); $('#close-modal').addEventListener('click', () => $('#viewer').close()); $('#viewer').addEventListener('click', (event) => { if (event.target === $('#viewer')) $('#viewer').close(); });
  fetch(registryUrl + '?v=public-archive-20261028', {cache:'no-store'}).then((response) => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); }).then((data) => { registry = data; updateMetrics(); render(); $('#registry-status').textContent = '● 공개 캐릭터 아카이브 · ' + data.actors.length + '명'; }).catch((error) => { $('#registry-message').textContent = archiveName + ' 로딩 실패: ' + error.message; $('#grid').innerHTML = '<p class="empty">캐릭터 자료를 불러오지 못했습니다.</p>'; });
})();
