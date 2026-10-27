(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PAGE_SIZE = 30;
  let registry = null;
  let ocrIndex = null;
  let unresolvedRegister = null;
  let candidateVerification = null;
  let assetFilter = 'all';
  let family = 'all';
  let page = 1;

  function installOriginalImageViewer() {
    const selector = '#grid .thumb img, #viewer img, #asset-gallery img';
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
      const haystack = JSON.stringify(actor).toLowerCase();
      return (family === 'all' || actor.family === family) &&
        (!q || haystack.includes(q)) && (!status || actor.status === status) &&
        (!age || actor.age_band === age) && (!archetype || actor.archetype === archetype);
    });
  }

  function updateMetrics() {
    const actors = registry.actors;
    $('#metric-total').textContent = actors.length;
    $('#metric-dna').textContent = actors.filter((a) => a.dna_approved).length;
    $('#metric-color').textContent = actors.filter((a) => a.status === 'APPROVED' && a.color_sheet_url).length;
    $('#metric-ink').textContent = actors.filter((a) => a.status === 'APPROVED' && a.ink_sheet_url).length;
    $('#metric-acting').textContent = actors.filter((a) => a.acting_set_approved).length;
    $('#metric-pages').textContent = (ocrIndex?.total_pages || 0).toLocaleString('ko-KR');
    $('#metric-ocr').textContent = (ocrIndex?.ocr_completed_pages || 0).toLocaleString('ko-KR');
    $('#metric-rework').textContent = actors.filter((a) => a.status === 'REWORK').length;
    document.querySelectorAll('[data-family]').forEach((button) => {
      const key = button.dataset.family;
      const count = key === 'all' ? actors.length : actors.filter((a) => a.family === key).length;
      const sub = button.querySelector('.tab-sub');
      sub.textContent = `${familyLabels[key]} · ${count}명`;
    });
  }

  function renderVolumeIndex() {
    const volumes = ocrIndex?.volumes || [];
    $('#volume-review-nav').innerHTML = volumes.map((item) => {
      const source = `/aistory/comic_view.asp?id=${item.viewer_id}`;
      const reviewUrl = item.review_url || `/aistory/goltong-dna-volume${String(item.volume).padStart(2, '0')}-review.html`;
      const review = `<a class="review-ready" href="${esc(reviewUrl)}" title="${item.volume}권 DNA 검수실">검수실</a>`;
      return `<span class="volume-source"><a href="${source}" target="_blank" rel="noopener" title="${item.volume}권 원본 ${item.pages}쪽">${item.volume}권 원본</a>${review}</span>`;
    }).join('');
  }

  function renderOcrStatus() {
    if (!ocrIndex) return;
    const complete = ocrIndex.machine_draft_pages ?? ocrIndex.ocr_completed_pages ?? 0;
    const approved = ocrIndex.human_approved_pages || 0;
    const discrepancyCount = (ocrIndex.discrepancies || []).length;
    $('#ocr-status').innerHTML = `<strong>${esc(ocrIndex.status)}</strong><span>원본 ${ocrIndex.total_volumes}권 · ${Number(ocrIndex.total_pages).toLocaleString('ko-KR')}쪽 연결 완료</span><span>OCR 기계 초벌 ${Number(complete).toLocaleString('ko-KR')} / ${Number(ocrIndex.total_pages).toLocaleString('ko-KR')}쪽 · 사람 승인 ${Number(approved).toLocaleString('ko-KR')}쪽</span><span>검증 불일치 ${discrepancyCount}건 · 뷰어 음성·핫스폿 자료는 OCR 근거에서 제외</span><span>화자·유형·인물 신원은 사람 검수 전까지 후보로만 기록</span>`;
  }

  function actorVisualAssets() {
    const assets = [];
    registry.actors.forEach((actor) => {
      if (actor.color_sheet_url) assets.push({
        group: 'actor', kind: '배우 정본', id: actor.actor_id, name: actor.actor_name,
        label: actor.rank_label || '', image: actor.color_sheet_url,
        metadata: actor.ai_prompt_metadata_url || '', source: actor.ink_sheet_url || ''
      });
      (actor.appearance_variants || []).forEach((variant) => {
        const image = variant.color_sheet_url || variant.image_url;
        if (!image) return;
        assets.push({
          group: 'actor', kind: variant.image_url ? '연기 시트' : '외형 변형',
          id: variant.variant_id || actor.actor_id, name: actor.actor_name,
          label: variant.label || '', image,
          metadata: variant.metadata_url || variant.ai_prompt_metadata_url || '',
          source: variant.source_url || ''
        });
      });
    });
    return [...new Map(assets.map((item) => [item.image, item])).values()];
  }

  function candidateVisualAssets() {
    return (unresolvedRegister?.candidates || []).filter((candidate) => candidate.production?.asset_url).map((candidate) => ({
      group: 'candidate', kind: candidate.production_class === 'EXTRA_SHEET' ? '단역·엑스트라' : '신원 후보',
      id: candidate.candidate_id, name: candidate.display_name,
      label: `${(candidate.volumes || []).map((volume) => `${volume}권`).join(' · ')} · ${candidate.state}`,
      image: candidate.production.asset_url,
      metadata: candidate.production.metadata_url || '',
      source: candidate.evidence?.[0]?.source_url || ''
    }));
  }

  function renderProgressDashboard() {
    const actorCount = registry.actors.length;
    const actorAssets = actorVisualAssets();
    const candidates = unresolvedRegister?.candidates || [];
    const producedCandidates = candidateVisualAssets().length;
    const candidateTotal = candidates.length;
    const remaining = candidateTotal - producedCandidates;
    const totalUnits = Number(unresolvedRegister?.total_identity_units || 0);
    const resolvedUnits = Number(unresolvedRegister?.resolved_identity_units || 0);
    const totalPages = Number(ocrIndex?.total_pages || 0);
    const ocrPages = Number(ocrIndex?.machine_draft_pages ?? ocrIndex?.ocr_completed_pages ?? 0);
    const sourcePct = totalPages ? 100 : 0;
    const reviewPct = (ocrIndex?.volumes || []).length === 25 ? 100 : ((ocrIndex?.volumes || []).length / 25) * 100;
    const identityPct = totalUnits ? resolvedUnits / totalUnits * 100 : 0;
    const visualDenominator = actorCount + candidateTotal;
    const visualNumerator = actorCount + producedCandidates;
    const visualPct = visualDenominator ? visualNumerator / visualDenominator * 100 : 0;
    const ocrPct = totalPages ? ocrPages / totalPages * 100 : 0;
    const overall = sourcePct * .10 + reviewPct * .10 + identityPct * .20 + visualPct * .40 + ocrPct * .20;
    const progress = [
      ['원자료 연결', sourcePct, `${totalPages.toLocaleString('ko-KR')} / ${totalPages.toLocaleString('ko-KR')}쪽`, '10%'],
      ['권별 검수실', reviewPct, `25 / 25권`, '10%'],
      ['신원 확정', identityPct, `${resolvedUnits} / ${totalUnits}단위`, '20%'],
      ['캐릭터 시각화', visualPct, `${visualNumerator} / ${visualDenominator}시트 대상`, '40%'],
      ['OCR 기계 초벌', ocrPct, `${ocrPages.toLocaleString('ko-KR')} / ${totalPages.toLocaleString('ko-KR')}쪽 · 사람 승인 ${Number(ocrIndex?.human_approved_pages || 0).toLocaleString('ko-KR')}쪽`, '20%']
    ];
    $('#progress-overall').textContent = `${Math.round(overall)}%`;
    $('#progress-bars').innerHTML = progress.map(([name, percent, fraction, weight]) => `<article class="progress-item"><header><span>${name}</span><strong>${percent.toFixed(percent === 100 ? 0 : 1)}%</strong></header><div class="progress-track"><span style="width:${Math.max(0, Math.min(100, percent))}%"></span></div><small>${fraction} · 가중치 ${weight}</small></article>`).join('');
    $('#progress-assets').textContent = (actorAssets.length + producedCandidates).toLocaleString('ko-KR');
    $('#progress-actors').textContent = actorCount.toLocaleString('ko-KR');
    $('#progress-candidates').textContent = `${producedCandidates} / ${candidateTotal}`;
    $('#progress-remaining').textContent = remaining.toLocaleString('ko-KR');
    $('#progress-reviews').textContent = '25 / 25';
    $('#progress-ocr').textContent = `${ocrPages.toLocaleString('ko-KR')} / ${totalPages.toLocaleString('ko-KR')}`;
    const verification = candidateVerification?.summary || {};
    $('#progress-updated').textContent = `데이터 갱신 ${registry.updated_at || '미기록'} · 후보 자산 검증 ${verification.status || '미확인'} ${verification.passed || 0}/${verification.candidate_count || 0} · 오류 ${verification.errors || 0}건`;
  }

  function assetCard(item) {
    const links = [
      item.source ? `<a href="${esc(item.source)}" target="_blank" rel="noopener">원작 근거</a>` : '',
      item.metadata ? `<a href="${esc(item.metadata)}" target="_blank" rel="noopener">DNA 메타데이터</a>` : ''
    ].filter(Boolean).join('');
    return `<article class="asset-card" data-asset-group="${esc(item.group)}"><figure><img loading="lazy" src="${esc(item.image)}" alt="${esc(item.name)} ${esc(item.kind)}"><figcaption><span class="asset-kind">${esc(item.kind)} · ${esc(item.id)}</span><strong>${esc(item.name)}</strong><span>${esc(item.label)}</span></figcaption></figure>${links ? `<div class="asset-links">${links}</div>` : ''}</article>`;
  }

  function renderAssetGallery() {
    const actorAssets = actorVisualAssets();
    const candidateAssets = candidateVisualAssets();
    const assets = [...actorAssets, ...candidateAssets];
    $('#asset-gallery').innerHTML = assets.map(assetCard).join('');
    $('#asset-register-status').textContent = `총 ${assets.length}장 · 배우 정본 ${registry.actors.length}장 · 외형/연기 변형 ${actorAssets.length - registry.actors.length}장 · 후보/단역 ${candidateAssets.length}장 · 잔여 ${Math.max(0, (unresolvedRegister?.candidates || []).length - candidateAssets.length)}장`;
    applyAssetFilter();
  }

  function applyAssetFilter() {
    document.querySelectorAll('#asset-gallery .asset-card').forEach((card) => {
      card.hidden = assetFilter !== 'all' && card.dataset.assetGroup !== assetFilter;
    });
    document.querySelectorAll('[data-asset-filter]').forEach((button) => button.classList.toggle('active', button.dataset.assetFilter === assetFilter));
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
    const visualVariants = [{label:'주 정본', image}, ...variants.map((variant) => ({label:variant.label || '변형', image:variant.color_sheet_url || variant.image_url})).filter((variant) => variant.image)];
    const thumbMedia = visualVariants.length > 1
      ? `<div class="variant-card-images">${visualVariants.map((variant) => `<figure><img loading="lazy" src="${esc(variant.image)}" alt="${esc(actor.actor_name)} ${esc(variant.label)}"><figcaption>${esc(variant.label)}</figcaption></figure>`).join('')}</div>`
      : `<img loading="lazy" src="${esc(image)}" alt="${esc(actor.actor_name)} ${actor.status === 'APPROVED' ? '컬러 정본' : '컬러 후보'}">`;
    return `<article class="card actor-card" data-actor-id="${esc(actor.actor_id)}">
      <div class="thumb ${visualVariants.length > 1 ? 'has-variants' : ''}" data-open-actor="${esc(actor.actor_id)}">${thumbMedia}<span class="badge">${esc(actor.actor_id)}</span><span class="badge auto ${esc(actor.status)}">${esc(statusLabels[actor.status] || actor.status)}</span></div>
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
    $('#registry-message').textContent = `${familyLabels[family]} · 조건에 맞는 배우 기록 ${actors.length}명`;
    $('#grid').innerHTML = shown.length ? shown.map(actorCard).join('') : `<p class="empty"><strong>등록된 하승남DNA 배우 정본이 없습니다.</strong><span>현재는 정상적인 준비 상태입니다. 골통대난동 원화 대조와 사용자 승인을 통과한 배우만 이곳에 등록합니다.</span></p>`;
    renderPager(actors.length, pages);
  }

  function openActor(id) {
    const actor = registry.actors.find((item) => item.actor_id === id);
    if (!actor) return;
    $('#modal-title').textContent = `${actor.actor_name} · ${actor.actor_id}`;
    $('#modal-color').src = actor.color_sheet_url || './aistory/assets/hyeolgyeon-v2/pending-sheet.svg';
    $('#modal-ink').src = actor.ink_sheet_url || './aistory/assets/hyeolgyeon-v2/pending-sheet.svg';
    const history = (actor.castings || []).map((casting) => `<article><strong>${esc(casting.work_title)}</strong><p>${esc(casting.role_grade || actor.rank_label || '')} · ${esc(casting.role_name)} · 출연 ${esc((casting.volumes || []).join(', '))}권</p><p>${esc(casting.role_note || '')}</p>${casting.comparison_url ? `<a href="${esc(casting.comparison_url)}">원작 대조 검수실</a>` : ''}</article>`).join('') || '<p>아직 작품 캐스팅 이력이 없습니다.</p>';
    const variants = actor.appearance_variants || [];
    const variantGallery = variants.length ? `<section class="appearance-variants"><div class="variant-heading"><span class="dna-kicker">ONE ACTOR · CHRONOLOGY-LOCKED LOOKS</span><h3>추가 외형·연기 시트 ${variants.length}종</h3><p>같은 배우 ID를 유지하되, 작품의 시간대와 장면 연기에 맞는 시트를 선택합니다.</p></div><div class="variant-detail-grid">${variants.map((variant) => { const variantImage = variant.color_sheet_url || variant.image_url; const sourceImage = variant.ink_sheet_url || variant.source_url || actor.ink_sheet_url; const metadata = variant.ai_prompt_metadata_url || variant.metadata_url; const scope = variant.volume_scope || variant.volumes || []; return `<article><div class="variant-pair"><figure><img loading="lazy" src="${esc(variantImage)}" alt="${esc(actor.actor_name)} ${esc(variant.label)}"><figcaption>추가 제작 시트</figcaption></figure><figure><img loading="lazy" src="${esc(sourceImage)}" alt="${esc(actor.actor_name)} 원작 먹선"><figcaption>원작 식별 근거</figcaption></figure></div><h4>${esc(variant.label)}</h4><p>${esc(variant.face_dna || variant.identity_evidence || '')}</p><p class="variant-scope">적용 권: ${esc(scope.map((v) => `${v}권`).join(' · ') || '장면 연기 참조')}</p>${metadata ? `<a class="variant-metadata" href="${esc(metadata)}" download>이 버전의 AI 프롬프트 메타데이터</a>` : ''}</article>`; }).join('')}</div></section>` : '';
    const reuse = actor.ai_reuse || {};
    const integrity = actor.asset_integrity || {};
    $('#modal-dna').innerHTML = `<header><span class="dna-kicker">${esc(actor.actor_id)} · PERMANENT DNA</span><h2>${esc(actor.actor_name)} <small>${esc(actor.name_hanja || '')}</small></h2><p class="dna-alias">${esc((actor.aliases || []).join(' · '))}</p><blockquote>${esc(actor.actor_logline || '')}</blockquote></header>${variantGallery}<div class="dna-columns"><section><h3>얼굴·골격 DNA</h3><p>${esc(actor.face_dna || '')}</p></section><section><h3>연기 범위</h3><p>${esc(actor.performance_range || '')}</p></section><section><h3>변형 허용 범위</h3><p>${esc(actor.allowed_variations || '')}</p></section></div><section class="ai-prompt-panel"><div class="prompt-heading"><div><span class="dna-kicker">AI READY · PROVENANCE AWARE</span><h3>AI 재활용 프롬프트 · 주 정본</h3></div><div class="prompt-actions"><button type="button" data-copy-prompt="effective">실제 유효 프롬프트 복사</button><button type="button" data-copy-prompt="identity">정체성 프롬프트 복사</button><button type="button" data-copy-prompt="casting">새 배역 템플릿 복사</button>${actor.ai_prompt_metadata_url ? `<a href="${esc(actor.ai_prompt_metadata_url)}" download>이미지 메타데이터 JSON</a>` : ''}</div></div><p class="prompt-truth"><b>기록 구분:</b> 실제 유효 프롬프트 ${esc(actor.prompt_provenance?.effective_generation_prompt_status || '미확인')} · 재사용 정규화본 ${esc(actor.prompt_provenance?.portable_prompt_status || '미확인')}</p><h4>실제 생성 기록의 유효 프롬프트</h4><pre id="actor-effective-prompt">${esc(reuse.verbatim_effective_generation_prompt || '')}</pre><h4>정체성 고정 프롬프트</h4><pre id="actor-identity-prompt">${esc(reuse.portable_identity_prompt || '')}</pre><h4>새 작품 캐스팅 템플릿</h4><pre id="actor-casting-prompt">${esc(reuse.casting_prompt_template || '')}</pre><details><summary>네거티브 프롬프트·파일 무결성</summary><pre>${esc(reuse.negative_prompt || '')}</pre><p class="hash-line">컬러 SHA-256 ${esc(integrity.color_sha256 || '')}<br>먹선 SHA-256 ${esc(integrity.ink_sha256 || '')}<br>크기 ${esc((integrity.color_dimensions || []).join(' × '))}<br>생성 원본 ${esc(actor.prompt_provenance?.original_generated_filename || '')}</p></details></section><h3>작품별 캐스팅 이력</h3><div class="casting-history">${history}</div>`;
    $('#viewer').showModal();
  }

  async function copyPrompt(kind) {
    const target = kind === 'casting' ? $('#actor-casting-prompt') : kind === 'effective' ? $('#actor-effective-prompt') : $('#actor-identity-prompt');
    const button = document.querySelector(`[data-copy-prompt="${kind}"]`);
    if (!target || !button) return;
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(target.textContent);
    } else {
      const helper = document.createElement('textarea');
      helper.value = target.textContent;
      helper.style.position = 'fixed'; helper.style.opacity = '0';
      document.body.appendChild(helper); helper.select();
      if (!document.execCommand('copy')) throw new Error('copy unavailable');
      helper.remove();
    }
    const previous = button.textContent;
    button.textContent = '복사 완료';
    setTimeout(() => { button.textContent = previous; }, 1200);
  }

  document.addEventListener('click', (event) => {
    const familyButton = event.target.closest('[data-family]');
    const pageButton = event.target.closest('[data-page]');
    const actorButton = event.target.closest('[data-open-actor]');
    const copyButton = event.target.closest('[data-copy-prompt]');
    const assetFilterButton = event.target.closest('[data-asset-filter]');
    if (familyButton) { family = familyButton.dataset.family; page = 1; document.querySelectorAll('[data-family]').forEach((button) => button.classList.toggle('active', button === familyButton)); render(); }
    if (pageButton) { page = Number(pageButton.dataset.page); render(); }
    if (actorButton) { event.preventDefault(); openActor(actorButton.dataset.openActor); }
    if (copyButton) { copyPrompt(copyButton.dataset.copyPrompt).catch(() => { copyButton.textContent = '복사 실패'; }); }
    if (assetFilterButton) { assetFilter = assetFilterButton.dataset.assetFilter; applyAssetFilter(); }
  });
  installOriginalImageViewer();
  ['search','status-filter','age-filter','archetype-filter'].forEach((id) => $('#' + id).addEventListener(id === 'search' ? 'input' : 'change', () => { page = 1; render(); }));
  $('#prev-page').addEventListener('click', () => { if (page > 1) { page--; render(); } });
  $('#next-page').addEventListener('click', () => { page++; render(); });
  $('#close-modal').addEventListener('click', () => $('#viewer').close());
  $('#viewer').addEventListener('click', (event) => { if (event.target === $('#viewer')) $('#viewer').close(); });
  $('#export').addEventListener('click', () => { const blob = new Blob([JSON.stringify(registry, null, 2)], {type:'application/json'}); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'haseungnam-dna-actor-registry.json'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); });

  Promise.all([
    fetch('./aistory/data/haseungnam-dna-actors.json?v=goltong-progress-20261028', {cache:'no-store'}),
    fetch('./aistory/data/goltong-dialogue-ocr-index.json?v=goltong-progress-20261028', {cache:'no-store'}),
    fetch('./aistory/data/goltong-unresolved-character-register.json?v=goltong-progress-20261028', {cache:'no-store'}),
    fetch('./aistory/data/goltong-candidate-asset-verification.json?v=goltong-progress-20261028', {cache:'no-store'})
  ])
    .then(async (responses) => {
      responses.forEach((response) => { if (!response.ok) throw new Error(`HTTP ${response.status} · ${response.url}`); });
      return Promise.all(responses.map((response) => response.json()));
    })
    .then(([actorData, ocrData, unresolvedData, verificationData]) => { registry = actorData; ocrIndex = ocrData; unresolvedRegister = unresolvedData; candidateVerification = verificationData; updateMetrics(); renderDevelopment(); renderVolumeIndex(); renderOcrStatus(); renderProgressDashboard(); renderAssetGallery(); render(); $('#registry-status').textContent = `● ${actorData.schema} · ${actorData.version}`; })
    .catch((error) => { $('#registry-message').textContent = `배우 원장 로딩 실패: ${error.message}`; $('#grid').innerHTML = '<p class="empty">배우 원장을 불러오지 못했습니다.</p>'; });
})();
