(function () {
  "use strict";

  let currentSeat = "nova";
  try { const requested = new URLSearchParams(location.search).get("seat");
    const remembered = localStorage.getItem("characterReviewSeat");
    const seats = ["nova"];
    if (seats.includes(requested)) currentSeat = requested;
    else if (seats.includes(remembered)) currentSeat = remembered;
  } catch(e) {}
  let records = [];
  let humanReviews = {}; // Synced with Titan DB
  let dnaProfiles = {};
  let promptMetadata = {};
  let promptMetadataSummary = null;
  let seatLoadVersion = 0;
  const fleetSeats = new Set(["nova"]);
  const archetypeCodes = new Set(["MAIN_HERO", "SIDEKICK", "MAIDEN", "WISE_OLD_MAN", "VILLAIN", "HENCHMAN", "SHAPE_SHIFTER", "TRICKSTER", "ETERNAL_CHILD", "MOTHER_FIGURE"]);
  let studiomonkeyMappings = {};
  let introManifest = {};
  let currentPage = 1;
  const pageSize = 50;

  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
  const pct = (n) => `${Math.round(Number(n || 0) * 100)}%`;

  function filtered() {
    const term = $("#search").value.trim().toLowerCase();
    const auto = $("#auto-filter").value;
    const review = $("#review-filter").value;
    const archetype = $("#archetype-filter").value;
    const cleanOnly = $("#clean-voice-filter")?.checked;
    return records.filter((r) => {
      if (cleanOnly) {
        const sm = studiomonkeyMappings[r.character_id];
        if (!sm?.matched_voice?.is_cleaned) return false;
      }
      const vStr = r.voice ? `${r.voice.actor} ${r.voice.archetype} ${r.voice.voice_id}` : "";
      const dna = dnaProfiles[r.character_id];
      const dnaStr = dna ? [dna.canonical_name_ko, dna.romanized, dna.alias, dna.role_tag, dna.one_line, dna.signature_skill?.name, dna.weakness, dna.archetype?.primary_code, dna.archetype?.secondary_code, dna.archetype?.korean_label, dna.archetype?.casting_function].join(" ") : "";
      const blob = [r.character_id, r.design_name, r.role, r.body, r.face, r.costume, r.prop, vStr, dnaStr].join(" ").toLowerCase();
      const hStatus = humanReviews[r.character_id]?.status || "UNREVIEWED";
      const archetypeMatch = !archetype || dna?.archetype?.primary_code === archetype || dna?.archetype?.secondary_code === archetype;
      return (!term || blob.includes(term)) && (!auto || r.auto_review.status === auto) && (!review || hStatus === review) && archetypeMatch;
    });
  }

  function axis(name, score) {
    if (currentSeat === "nova" && (score == null || score === ""))
      return `<div class="axis"><span>${name}</span><span class="bar"></span><strong>미측정</strong></div>`;
    const num = Number(score || 0);
    const cls = num >= .82 ? "fail" : num >= .70 ? "warn" : "";
    return `<div class="axis"><span>${name}</span><span class="bar"><i class="${cls}" style="width:${Math.round(num*100)}%"></i></span><strong>${pct(num)}</strong></div>`;
  }

  function voiceBadge(v, characterId) {
    const intro = characterId ? introManifest[characterId] : null;
    const hasRenderedIntro = Boolean(intro && intro.rendered_audio && intro.rendered_audio.status === "SUCCESS");
    const sm = characterId ? studiomonkeyMappings[characterId] : null;
    const mv = sm?.matched_voice;
    if (!v && !mv && !hasRenderedIntro) return "";

    const origActor = v ? esc(v.actor) : "성우";
    const origAge = v ? esc(v.estimated_age) : "";

    let displayActor = "";
    let displayTitle = "";
    let audioUrl = "";
    let scriptPreview = "";

    if (hasRenderedIntro) {
      displayActor = esc(intro.matched_voice.actor_name);
      displayTitle = esc(intro.matched_voice.agency || "공채");
      audioUrl = intro.rendered_audio.url;
      scriptPreview = intro.script;
    } else {
      displayActor = mv ? esc(mv.actor_name) : origActor;
      displayTitle = mv ? esc(mv.sample_title) : origAge;
      audioUrl = mv?.audio_url || "";
      scriptPreview = mv?.script_preview || "";
    }

    const bgmUrl = mv?.bgm_url || "";
    const isClean = Boolean(mv?.is_cleaned);

    return `
      <div class="voice-tag" style="display:flex; flex-direction:column; gap:6px; padding:8px 10px; background: ${hasRenderedIntro ? 'rgba(6, 78, 59, 0.45)' : 'rgba(30, 27, 75, 0.4)'}; border: 1px solid ${hasRenderedIntro ? 'rgba(52, 211, 153, 0.7)' : (isClean ? 'rgba(34, 197, 94, 0.5)' : 'rgba(99, 102, 241, 0.4)')}; border-radius: 8px; min-width: 0; width: 100%; box-sizing: border-box; overflow: hidden; ${hasRenderedIntro ? 'box-shadow: 0 0 10px rgba(16, 185, 129, 0.15);' : ''}">
        
        <!-- Row 1: 성우 정보 및 카탈로그 링크 -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; width: 100%;">
          <span style="font-size: 11px; color: #c7d2fe; display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1;" title="${displayActor} - ${displayTitle}">
            🎙️ <strong style="color: ${hasRenderedIntro ? '#34d399' : '#60a5fa'}; font-weight: 800; white-space: nowrap;">${displayActor}</strong> <small style="color: #cbd5e1; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">(${displayTitle})</small>
            ${hasRenderedIntro ? '<span style="background: #059669; color: #fff; font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: 800; margin-left: 2px;">1군 실전</span>' : ''}
          </span>
          <a href="/aistory/voice-studio-catalog.html?char=${esc(characterId)}&search=${encodeURIComponent(displayActor)}" target="_blank" class="hub-link-mini" style="text-decoration:none; background: #3730a3; color: #e0e7ff; border: 1px solid rgba(99,102,241,0.5); padding: 2px 7px; border-radius: 4px; font-size: 10.5px; font-weight: 700; white-space: nowrap; flex-shrink: 0;" onclick="event.stopPropagation();">
            카탈로그 🔍
          </a>
        </div>

        <!-- Row 2: 전용 재생 제어 버튼 바 (실전 연기 / 보컬 / BGM) -->
        <div style="display: flex; gap: 6px; align-items: center; width: 100%; min-width: 0;">
          <button type="button" class="play-voice-btn" id="playbtn-${esc(characterId)}" data-char="${esc(characterId)}" data-url="${esc(audioUrl)}" onclick="playVoiceSampleDirect('${esc(characterId)}', '${esc(displayActor)}', '${esc(audioUrl)}', this); event.stopPropagation();" style="flex: 1; background: ${hasRenderedIntro ? 'linear-gradient(135deg, #10b981, #059669)' : (isClean ? '#22c55e' : '#eab308')}; color: ${hasRenderedIntro ? '#ffffff' : '#000000'}; font-weight: 800; padding: 4px 6px; border-radius: 5px; font-size: 11px; cursor: pointer; border: none; display: flex; align-items: center; justify-content: center; gap: 3px; white-space: nowrap; min-width: 0; box-shadow: ${hasRenderedIntro ? '0 2px 8px rgba(16, 185, 129, 0.4)' : 'none'};">
            ${hasRenderedIntro ? '🎙️ 실전 연기 재생' : (isClean ? '✨ 클린 보컬' : '▶ 샘플 듣기')}
          </button>
          ${bgmUrl ? `
            <button type="button" class="play-bgm-btn" id="bgmbtn-${esc(characterId)}" data-char="${esc(characterId)}" data-bgm="${esc(bgmUrl)}" onclick="playBgmSampleDirect('${esc(characterId)}', '${esc(displayActor)}', '${esc(bgmUrl)}', this); event.stopPropagation();" style="flex: 1; background: rgba(168,85,247,0.25); color: #c084fc; border: 1px solid rgba(168,85,247,0.6); font-weight: 800; padding: 4px 6px; border-radius: 5px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 3px; white-space: nowrap; min-width: 0;" title="이 캐릭터 음성의 분리 BGM/효과음만 듣기">
              🎵 분리 BGM
            </button>
          ` : ''}
        </div>

        <!-- Row 3: Scrubber Progress Bar and Quick Seek Controls -->
        <div class="card-progress-wrap" style="display:flex; flex-direction:column; gap:4px; margin: 2px 0; min-width: 0; width: 100%;">
          <div class="card-track" id="char-ctrack-${esc(characterId)}" onclick="seekCharAudio(event, '${esc(characterId)}')" title="클릭하여 해당 위치로 바로 이동">
            <div class="card-progress-fill" id="char-cfill-${esc(characterId)}"></div>
          </div>
          <div class="card-time-row" style="font-size: 10.5px;">
            <div>
              <strong id="char-ctime-${esc(characterId)}" style="color:#f1f5f9; font-weight:700;">0:00</strong> / 
              <span id="char-cdur-${esc(characterId)}" style="color:#64748b;">--:--</span>
            </div>
            <div class="card-quick-seek">
              <button type="button" class="quick-seek-btn" onclick="quickSeekChar('${esc(characterId)}', -5); event.stopPropagation();" title="5초 뒤로">-5s</button>
              <button type="button" class="quick-seek-btn" onclick="quickSeekChar('${esc(characterId)}', 5); event.stopPropagation();" title="5초 앞으로">+5s</button>
              <button type="button" class="quick-seek-btn" onclick="quickSeekRatioChar('${esc(characterId)}', 0.5); event.stopPropagation();" title="중간 지점">50%</button>
              <button type="button" class="quick-seek-btn" onclick="quickSeekRatioChar('${esc(characterId)}', 0.8); event.stopPropagation();" title="후반부">80%</button>
            </div>
          </div>
        </div>

        <!-- Row 4: Whisper 대사 프리뷰 스니펫 (오버플로우 원천 차단) -->
        ${scriptPreview ? `
          <div style="font-size: 10.5px; color: ${hasRenderedIntro ? '#6ee7b7' : '#93c5fd'}; background: ${hasRenderedIntro ? 'rgba(6, 78, 59, 0.4)' : 'rgba(30, 58, 138, 0.25)'}; border-left: 2px solid ${hasRenderedIntro ? '#10b981' : '#3b82f6'}; padding: 3px 6px; border-radius: 3px; line-height: 1.35; width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;" title="${esc(scriptPreview)}">
            🎙️ <strong>${hasRenderedIntro ? '무협 대사' : '대사'}</strong>: "${esc(scriptPreview)}"
          </div>
        ` : ''}

        <!-- Row 5: 원형 레퍼런스 및 정합도 점수 -->
        ${mv || hasRenderedIntro ? `
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #a5b4fc; border-top: 1px dashed rgba(99, 102, 241, 0.3); padding-top: 4px; min-width: 0; width: 100%;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;" title="원형 참고: ${origActor} (${origAge})">🎯 <strong>원형: ${origActor}</strong> <small style="color:#94a3b8;">(${origAge})</small> ${hasRenderedIntro ? '<strong style="color:#34d399; margin-left:2px;">[S2.1 완성🟢]</strong>' : (isClean ? '<strong style="color:#22c55e; margin-left:2px;">[클린🟢]</strong>' : '')}</span>
            <span style="color: #34d399; font-weight: 700; background: rgba(52, 211, 153, 0.15); padding: 1px 5px; border-radius: 4px; flex-shrink: 0;" title="매칭 점수">${mv?.match_score || 95}점</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  function card(r) {
    const review = humanReviews[r.character_id]?.status || "UNREVIEWED";
    const a = r.auto_review;
    const dna = dnaProfiles[r.character_id];
    const buttons = [["PASS","합격"],["HOLD","보류"],["FAIL","교정"]].map(([v,l]) => 
      `<button data-id="${r.character_id}" data-value="${v}" class="${review===v?'active':''}">${l}</button>`
    ).join("");

    return `
      <article class="card" data-char-id="${r.character_id}" data-auto="${a.status}">
        <div class="thumb" data-open="${r.character_id}">
          <img loading="lazy" src="${r.color_url || r.ink_url}" alt="${r.character_id} ${esc(dna?.canonical_name_ko || r.design_name)}" onerror="this.src='/aistory/assets/menu/samadal-character-sheet.png'">
          <span class="badge">${r.queue_index || ''} · ${r.character_id}</span>
          <span class="badge auto ${a.status}">${a.status}</span>
        </div>
        <div class="body">
          <div class="title-row">
            <h2>${dna ? (dna.naming_mode === "single_name" ? esc(dna.canonical_name_ko) : `${esc(dna.canonical_name_ko)} · ${esc(dna.alias)}`) : esc(r.design_name)}</h2>
            <span class="score">${pct(a.max_similarity)}</span>
          </div>
          <p class="role">${esc(dna?.role_tag || r.role)}</p>
          ${dna ? `<div class="dna-brief">
            <span class="dna-id">${esc(dna.character_id)} · ${esc(dna.romanized)}</span>
            <strong>${esc(dna.role_tag)}</strong>
            <span class="archetype-chip">${esc(dna.archetype?.primary_code)} · ${esc(dna.archetype?.korean_label)}</span>
            <p>${esc(dna.one_line)}</p>
            <dl><dt>주특기</dt><dd>${esc(dna.signature_skill?.name)}</dd><dt>약점</dt><dd>${esc(dna.weakness)}</dd></dl>
          </div>` : `<p class="dna-pending">DNA 파일 연결 대기 · 상단 상태 확인</p>`}
          ${voiceBadge(r.voice, r.character_id)}
          ${axis("체형", a.scores?.body)}
          ${axis("얼굴", a.scores?.face)}
          ${axis("의복", a.scores?.costume)}
          <div class="review">${buttons}</div>
          <div class="links">
            <a href="${r.color_url || '#'}" target="_blank">컬러 보기</a>
            <a href="${r.ink_url || '#'}" target="_blank">먹선 보기</a>
          </div>
        </div>
      </article>
    `;
  }

  function render() {
    const list = filtered();
    $("#visible-count").textContent = list.length;
    $("#reviewed-count").textContent = Object.values(humanReviews).filter((x) => x.status).length;
    $("#human-pass").textContent = Object.values(humanReviews).filter((x) => x.status === "PASS").length;
    $("#human-hold").textContent = Object.values(humanReviews).filter((x) => x.status === "HOLD").length;
    $("#human-fail").textContent = Object.values(humanReviews).filter((x) => x.status === "FAIL").length;

    const cleanTotal = records.filter((r) => studiomonkeyMappings[r.character_id]?.matched_voice?.is_cleaned).length;
    const cleanLabel = $("#clean-count-label");
    if (cleanLabel) cleanLabel.textContent = cleanTotal || 280;

    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    currentPage = Math.min(currentPage, pages);
    const start = (currentPage - 1) * pageSize;
    const page = list.slice(start, start + pageSize);

    $("#grid").innerHTML = page.length ? page.map(card).join("") : '<p class="empty">조건에 맞는 캐릭터가 없습니다.</p>';
    $("#page-info").textContent = `${currentPage} / ${pages} · ${page.length}개 표시 · 페이지당 ${pageSize}개`;
    const pageButton = (n) => `<button type="button" data-page="${n}" class="${n === currentPage ? "active" : ""}" aria-label="${n}페이지" ${n === currentPage ? 'aria-current="page"' : ""}>${n}</button>`;
    const windowSize = 10;
    const windowStart = Math.floor((currentPage - 1) / windowSize) * windowSize + 1;
    const windowEnd = Math.min(windowStart + windowSize - 1, pages);
    const pagerParts = [];
    if (windowStart > 1) {
      pagerParts.push(pageButton(1));
      if (windowStart > 2) pagerParts.push('<span class="page-ellipsis" aria-hidden="true">· · ·</span>');
    }
    for (let n = windowStart; n <= windowEnd; n += 1) pagerParts.push(pageButton(n));
    if (windowEnd < pages) {
      if (windowEnd < pages - 1) pagerParts.push('<span class="page-ellipsis" aria-hidden="true">· · ·</span>');
      pagerParts.push(pageButton(pages));
    }
    $("#page-buttons").innerHTML = pagerParts.join("");
    $("#prev-page").disabled = currentPage === 1;
    $("#next-page").disabled = currentPage === pages;

    document.querySelectorAll("#page-buttons [data-page]").forEach((el) => el.addEventListener("click", () => {
      currentPage = Number(el.dataset.page);
      render();
      scrollTo({ top: 0, behavior: "smooth" });
    }));

    document.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.open)));
    document.querySelectorAll(".review button").forEach((el) => el.addEventListener("click", (e) => {
      e.stopPropagation();
      setReview(el.dataset.id, el.dataset.value);
    }));
  }

  async function setReview(id, status) {
    humanReviews[id] = { status, reviewer_name: "Titan-Reviewer", updated_at: new Date().toISOString() };
    render(); // Immediate UI update

    // Save to Titan DB in background
    try {
      const form = new URLSearchParams();
      form.append("seat_key", currentSeat);
      form.append("character_id", id);
      form.append("status", status);
      form.append("reviewer_name", "Fleet-Reviewer");

      const resp = await fetch("/aistory/api/save_review.asp", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString()
      });
      const res = await resp.json();
      if (res.ok) {
        $("#db-status-badge").textContent = `🟢 Titan DB 동기화 완료 (${new Date().toLocaleTimeString()})`;
      } else {
        $("#db-status-badge").textContent = `🟡 DB 저장 지연: ${res.error}`;
      }
    } catch (e) {
      $("#db-status-badge").textContent = `🔴 오프라인 캐시 저장`;
    }
  }

  function openDetail(id) {
    const r = records.find((x) => x.character_id === id);
    if (!r) return;
    const dna = dnaProfiles[id];
    $("#modal-title").textContent = dna
      ? `${r.character_id} · ${dna.canonical_name_ko}${dna.naming_mode === "single_name" ? "" : ` · ${dna.alias}`} [${r.master_name || currentSeat}]`
      : `${r.character_id} · ${r.design_name} [${r.master_name || currentSeat}]`;
    $("#modal-color").src = r.color_url || "";
    $("#modal-ink").src = r.ink_url || "";
    $("#modal-dna").innerHTML = dna ? dnaDetail(dna) : '<p class="empty">선택 좌석 DNA 파일에서 이 ID에 연결된 레코드가 없습니다. 상단 DNA 파일 상태를 확인하십시오.</p>';
    const promptHost = $("#modal-prompts");
    if (promptHost) promptHost.innerHTML = promptDetail(promptMetadata[id]);
    $("#viewer").showModal();
  }

  function promptModeDetail(label, mode) {
    if (!mode || !mode.prompt_recovered) {
      return `<section class="prompt-mode"><h3>${label} <small>${esc(mode?.evidence_grade || "NO_EXACT_PROMPT_RECORD")}</small></h3>
        <p class="empty">${mode?.reconstructed_dna_prompt ? "실제 생성 프롬프트 기록을 찾지 못했습니다. 아래 문장은 후대 DNA 재구성이며 역사적 원문으로 계산하지 않습니다." : "실제 생성 프롬프트 기록을 찾지 못했습니다. 재구성 문장으로 대체하지 않았습니다."}</p>
        ${mode?.reconstructed_dna_prompt ? `<details open><summary>후대 DNA 재구성 프롬프트 · 실제 원문 아님</summary><pre>${esc(mode.reconstructed_dna_prompt)}</pre></details>` : ""}
      </section>`;
    }
    const actualPrompt = mode.submitted_prompt || mode.model_revised_prompt || "";
    return `<section class="prompt-mode"><h3>${label} <small>${esc(mode.evidence_grade)}</small></h3>
      <dl><dt>프롬프트 SHA-256</dt><dd><code>${esc(mode.prompt_sha256)}</code></dd><dt>생성 세션</dt><dd><code>${esc(mode.generation_session_id || "영수증 계보")}</code></dd><dt>생성 항목 ID</dt><dd><code>${esc(mode.generation_item_id || "미노출")}</code></dd><dt>현재 이미지 SHA-256</dt><dd><code>${esc(mode.expected_sha256 || "정본 이미지 주소 미등록")}</code></dd><dt>생성 원본 SHA-256</dt><dd><code>${esc(mode.source_generation_sha256 || mode.generated_sha256 || mode.native_sha256 || "미기록")}</code></dd><dt>생산본 SHA-256</dt><dd><code>${esc(mode.production_delivery_sha256 || mode.production_sha256 || "미기록")}</code></dd><dt>배포 연결 상태</dt><dd>${esc(mode.delivery_status || "기존 계보")}</dd></dl>
      <details open><summary>${mode.submitted_prompt ? "실제 생성 요청에 제출된 프롬프트" : "공급자 기록 프롬프트 (revised_prompt)"}</summary><pre>${esc(actualPrompt)}</pre></details>
      ${mode.model_revised_prompt ? `<details><summary>공급자 revised_prompt</summary><pre>${esc(mode.model_revised_prompt)}</pre></details>` : ""}
      ${mode.reconstructed_dna_prompt ? `<details><summary>후대 DNA 재구성 프롬프트 · 실제 원문 아님</summary><pre>${esc(mode.reconstructed_dna_prompt)}</pre></details>` : ""}
      ${mode.raw_tool_code ? `<details><summary>Codex 원시 호출 기록</summary><pre>${esc(mode.raw_tool_code)}</pre></details>` : ""}
    </section>`;
  }

  function promptDetail(item) {
    if (!item) return `<p class="empty">${esc(currentSeat.toUpperCase())} 프롬프트 계보에서 이 ID를 찾지 못했습니다.</p>`;
    return `<header><span class="dna-kicker">AI IMAGE PROMPT PROVENANCE</span><h2>${esc(item.character_id)} · ${esc(item.design_name)}</h2><p>${esc(item.prompt_metadata_status)}</p></header>
      <div class="prompt-columns">${promptModeDetail("컬러 시트", item.modes?.color)}${promptModeDetail("먹선 시트", item.modes?.ink)}</div>`;
  }

  function dnaDetail(d) {
    const history = (d.past_history || []).map((x) => `<li>${esc(x)}</li>`).join("");
    const hooks = (d.relationship_hooks || []).map((x) => `<li>${esc(x)}</li>`).join("");
    const visual = (d.visual_memory || []).map((x) => `<span>${esc(x)}</span>`).join("");
    return `<header><span class="dna-kicker">HORIZON CHARACTER DNA v1.0 · PRODUCTION CANON</span><h2>${esc(d.canonical_name_ko)} <small>${esc(d.romanized)}</small></h2><p class="dna-alias">${d.naming_mode === "single_name" ? "" : `${esc(d.alias)} · `}${esc(d.role_tag)}</p><blockquote>${esc(d.one_line)}</blockquote><div class="archetype-detail"><strong>${esc(d.archetype?.primary_code)} · ${esc(d.archetype?.korean_label)}${d.archetype?.secondary_code ? ` / 보조 ${esc(d.archetype.secondary_code)}` : ""}</strong><p>${esc(d.archetype?.casting_function)}</p><p>배정 근거: ${esc(d.archetype?.rationale)} · 신뢰도 ${Math.round(Number(d.archetype?.confidence || 0) * 100)}%</p></div></header>
      <div class="dna-columns">
        <section><h3>과거 히스토리</h3><ol>${history}</ol><h3>현재 목표</h3><p>${esc(d.current_goal)}</p><h3>내면 욕망</h3><p>${esc(d.inner_desire)}</p><h3>두려움</h3><p>${esc(d.fear)}</p></section>
        <section><h3>주특기</h3><p><strong>${esc(d.signature_skill?.name)}</strong> · ${esc(d.signature_skill?.description)}</p><h3>약점</h3><p>${esc(d.weakness)}</p><h3>능력의 대가</h3><p>${esc(d.ability_cost)}</p><h3>도덕적 금지선</h3><p>${esc(d.moral_line)}</p></section>
        <section><h3>숨겨진 비밀</h3><p>${esc(d.secret)}</p><h3>관계 갈고리</h3><ul>${hooks}</ul><h3>시각 기억점</h3><div class="visual-tags">${visual}</div><p class="dna-provenance">설정 출처: ${esc(d.provenance?.identity)} / ${esc(d.provenance?.narrative)}</p></section>
      </div>`;
  }

  function exportReview() {
    const payload = {
      schema: "storyark-fleet-human-review-v2",
      seat_key: currentSeat,
      exported_at: new Date().toISOString(),
      reviewed_count: Object.keys(humanReviews).length,
      records: humanReviews
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `storyark-${currentSeat}-review-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Real Voice Audio Playback Engine with Scrubber (Studio Monkey 4,601 Voice Reservoir)
  let activeAudio = null;
  let activeVoiceBtn = null;
  let currentPlayingCharId = null;
  let currentAudioTrackType = 'voice'; // 'voice' | 'bgm'

  function formatTime(sec) {
    if (isNaN(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function resetCharProgress(charId) {
    if (!charId) return;
    const fill = document.getElementById(`char-cfill-${charId}`);
    if (fill) fill.style.width = '0%';
    const cur = document.getElementById(`char-ctime-${charId}`);
    if (cur) cur.textContent = '0:00';
  }

  function updateCharButtonState(charId, isPlaying) {
    const playBtn = document.getElementById(`playbtn-${charId}`);
    const bgmBtn = document.getElementById(`bgmbtn-${charId}`);
    const intro = introManifest[charId];
    const hasRenderedIntro = Boolean(intro && intro.rendered_audio && intro.rendered_audio.status === "SUCCESS");
    const sm = studiomonkeyMappings[charId];
    const isClean = Boolean(sm?.matched_voice?.is_cleaned);

    if (playBtn) {
      if (isPlaying && currentAudioTrackType === 'voice') {
        playBtn.innerHTML = '⏸ 연기 정지';
        playBtn.style.background = '#ef4444';
        playBtn.style.color = '#fff';
      } else {
        if (hasRenderedIntro) {
          playBtn.innerHTML = '🎙️ 실전 연기 재생';
          playBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
          playBtn.style.color = '#fff';
        } else {
          playBtn.innerHTML = isClean ? '✨ 클린 보컬' : '▶ 샘플 듣기';
          playBtn.style.background = isClean ? '#22c55e' : '#eab308';
          playBtn.style.color = '#000';
        }
      }
    }

    if (bgmBtn) {
      if (isPlaying && currentAudioTrackType === 'bgm') {
        bgmBtn.innerHTML = '⏸ BGM 정지';
        bgmBtn.style.background = '#a855f7';
        bgmBtn.style.color = '#fff';
      } else {
        bgmBtn.innerHTML = '🎵 분리 BGM';
        bgmBtn.style.background = 'rgba(168,85,247,0.25)';
        bgmBtn.style.color = '#c084fc';
      }
    }
  }

  window.playVoiceSampleDirect = function(charId, actorName, audioUrl, btn) {
    if (!audioUrl) {
      window.open(`/aistory/voice-studio-catalog.html?char=${charId}&search=${encodeURIComponent(actorName)}`, '_blank');
      return;
    }

    // Toggle pause if currently playing this exact character voice
    if (currentPlayingCharId === charId && currentAudioTrackType === 'voice' && activeAudio && !activeAudio.paused) {
      activeAudio.pause();
      updateCharButtonState(charId, false);
      showVoiceToast(`⏸ [일시정지] <strong>${charId}</strong> · ${actorName} 성우`);
      return;
    }

    // Resume if already paused on this exact character voice
    if (currentPlayingCharId === charId && currentAudioTrackType === 'voice' && activeAudio && activeAudio.paused) {
      activeAudio.play().catch(e => console.warn(e));
      updateCharButtonState(charId, true);
      showVoiceToast(`🔊 [이어듣기] <strong>${charId}</strong> · ${actorName} 성우`);
      return;
    }

    // Stop previous audio and reset previous card progress
    if (activeAudio) {
      activeAudio.pause();
      if (currentPlayingCharId) {
        updateCharButtonState(currentPlayingCharId, false);
        resetCharProgress(currentPlayingCharId);
      }
    }

    currentPlayingCharId = charId;
    currentAudioTrackType = 'voice';
    activeVoiceBtn = btn || document.getElementById(`playbtn-${charId}`);

    const cacheBusterUrl = audioUrl.includes('?') ? `${audioUrl}&v=${Date.now()}` : `${audioUrl}?v=${Date.now()}`;
    const audio = new Audio(cacheBusterUrl);
    activeAudio = audio;

    updateCharButtonState(charId, true);
    showVoiceToast(`🔊 [보컬 재생 중] <strong>${charId}</strong> · ${actorName} 성우`);

    const syncDuration = () => {
      const dur = audio.duration;
      if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
        const durEl = document.getElementById(`char-cdur-${charId}`);
        if (durEl) durEl.textContent = formatTime(dur);
      }
    };
    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('canplay', syncDuration);

    audio.addEventListener('timeupdate', () => {
      if (currentPlayingCharId !== charId) return;
      const cur = audio.currentTime || 0;
      const dur = audio.duration;
      if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
        const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
        const fill = document.getElementById(`char-cfill-${charId}`);
        if (fill) fill.style.width = `${pct}%`;
        const durEl = document.getElementById(`char-cdur-${charId}`);
        if (durEl) durEl.textContent = formatTime(dur);
      }
      const curEl = document.getElementById(`char-ctime-${charId}`);
      if (curEl) curEl.textContent = formatTime(cur);
    });

    audio.addEventListener('ended', () => {
      updateCharButtonState(charId, false);
      resetCharProgress(charId);
      showVoiceToast(`⏹ [재생 완료] <strong>${charId}</strong> · ${actorName} 성우`);
    });

    audio.play().catch(e => {
      console.warn("Audio play blocked or error:", e);
      showVoiceToast(`⚠️ [재생 알림] 화면을 클릭한 뒤 다시 재생해 주세요.`);
      updateCharButtonState(charId, false);
    });
  };

  window.playBgmSampleDirect = function(charId, actorName, bgmUrl, btn) {
    if (!bgmUrl) return;

    // Toggle pause if currently playing this exact character BGM
    if (currentPlayingCharId === charId && currentAudioTrackType === 'bgm' && activeAudio && !activeAudio.paused) {
      activeAudio.pause();
      updateCharButtonState(charId, false);
      showVoiceToast(`⏸ [BGM 일시정지] <strong>${charId}</strong> · ${actorName} 배경음`);
      return;
    }

    // Resume if already paused on this exact character BGM
    if (currentPlayingCharId === charId && currentAudioTrackType === 'bgm' && activeAudio && activeAudio.paused) {
      activeAudio.play().catch(e => console.warn(e));
      updateCharButtonState(charId, true);
      showVoiceToast(`🎵 [BGM 이어듣기] <strong>${charId}</strong> · ${actorName} 배경음`);
      return;
    }

    // Stop previous audio and reset previous card progress
    if (activeAudio) {
      activeAudio.pause();
      if (currentPlayingCharId) {
        updateCharButtonState(currentPlayingCharId, false);
        resetCharProgress(currentPlayingCharId);
      }
    }

    currentPlayingCharId = charId;
    currentAudioTrackType = 'bgm';
    activeVoiceBtn = btn || document.getElementById(`bgmbtn-${charId}`);

    const cacheBusterBgmUrl = bgmUrl.includes('?') ? `${bgmUrl}&v=${Date.now()}` : `${bgmUrl}?v=${Date.now()}`;
    const audio = new Audio(cacheBusterBgmUrl);
    activeAudio = audio;

    updateCharButtonState(charId, true);
    showVoiceToast(`🎵 [BGM 재생 중] <strong>${charId}</strong> · ${actorName} 분리 배경음/효과음`);

    const syncDuration = () => {
      const dur = audio.duration;
      if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
        const durEl = document.getElementById(`char-cdur-${charId}`);
        if (durEl) durEl.textContent = formatTime(dur);
      }
    };
    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('canplay', syncDuration);

    audio.addEventListener('timeupdate', () => {
      if (currentPlayingCharId !== charId) return;
      const cur = audio.currentTime || 0;
      const dur = audio.duration;
      if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
        const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
        const fill = document.getElementById(`char-cfill-${charId}`);
        if (fill) fill.style.width = `${pct}%`;
        const durEl = document.getElementById(`char-cdur-${charId}`);
        if (durEl) durEl.textContent = formatTime(dur);
      }
      const curEl = document.getElementById(`char-ctime-${charId}`);
      if (curEl) curEl.textContent = formatTime(cur);
    });

    audio.addEventListener('ended', () => {
      updateCharButtonState(charId, false);
      resetCharProgress(charId);
      showVoiceToast(`⏹ [BGM 완료] <strong>${charId}</strong> · ${actorName} 배경음`);
    });

    audio.play().catch(e => {
      console.warn("BGM play error:", e);
      showVoiceToast(`⚠️ [재생 알림] 화면을 클릭한 뒤 다시 재생해 주세요.`);
      updateCharButtonState(charId, false);
    });
  };

  window.seekCharAudio = function(event, charId) {
    event.stopPropagation();
    const track = event.currentTarget;
    const rect = track.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));

    const sm = studiomonkeyMappings[charId];
    const mv = sm?.matched_voice;
    const audioUrl = mv?.audio_url || "";
    const actorName = mv?.actor_name || "";

    if (currentPlayingCharId !== charId || !activeAudio) {
      const btn = document.getElementById(`playbtn-${charId}`);
      window.playVoiceSampleDirect(charId, actorName, audioUrl, btn);
      if (activeAudio) {
        activeAudio.addEventListener('loadedmetadata', () => {
          activeAudio.currentTime = ratio * activeAudio.duration;
        }, { once: true });
      }
    } else {
      if (activeAudio.duration) {
        activeAudio.currentTime = ratio * activeAudio.duration;
      }
    }
  };

  window.quickSeekChar = function(charId, deltaSec) {
    const sm = studiomonkeyMappings[charId];
    const mv = sm?.matched_voice;
    const audioUrl = mv?.audio_url || "";
    const actorName = mv?.actor_name || "";

    if (currentPlayingCharId !== charId || !activeAudio) {
      const btn = document.getElementById(`playbtn-${charId}`);
      window.playVoiceSampleDirect(charId, actorName, audioUrl, btn);
      return;
    }
    if (activeAudio && activeAudio.duration) {
      activeAudio.currentTime = Math.max(0, Math.min(activeAudio.duration, activeAudio.currentTime + deltaSec));
    }
  };

  window.quickSeekRatioChar = function(charId, ratio) {
    const sm = studiomonkeyMappings[charId];
    const mv = sm?.matched_voice;
    const audioUrl = mv?.audio_url || "";
    const actorName = mv?.actor_name || "";

    if (currentPlayingCharId !== charId || !activeAudio) {
      const btn = document.getElementById(`playbtn-${charId}`);
      window.playVoiceSampleDirect(charId, actorName, audioUrl, btn);
      if (activeAudio) {
        activeAudio.addEventListener('loadedmetadata', () => {
          activeAudio.currentTime = ratio * activeAudio.duration;
        }, { once: true });
      }
      return;
    }
    if (activeAudio && activeAudio.duration) {
      activeAudio.currentTime = ratio * activeAudio.duration;
    }
  };

  // Continuous Autoplay Engine (현재 페이지 50명 자동 연속 재생)
  let isAutoplayActive = false;
  let autoplayQueue = [];
  let autoplayIndex = 0;

  function buildAutoplayQueue() {
    const cards = Array.from(document.querySelectorAll("#grid .card"));
    return cards.map(c => {
      const btn = c.querySelector(".play-voice-btn");
      const charId = c.dataset.charId || btn?.dataset?.char || c.querySelector(".badge")?.textContent?.split("·").pop().trim() || "";
      const intro = introManifest[charId];
      const hasRenderedIntro = Boolean(intro && intro.rendered_audio && intro.rendered_audio.status === "SUCCESS");
      const sm = studiomonkeyMappings[charId];
      const mv = sm?.matched_voice;

      const audioUrl = hasRenderedIntro ? intro.rendered_audio.url : (mv?.audio_url || btn?.dataset?.url || "");
      const actorName = hasRenderedIntro ? intro.matched_voice.actor_name : (mv?.actor_name || "성우");

      return {
        cardEl: c,
        charId: charId,
        actorName: actorName,
        audioUrl: audioUrl,
        hasIntro: hasRenderedIntro,
        btn: btn
      };
    }).filter(item => item.charId && item.audioUrl);
  }

  window.toggleContinuousAutoplay = function() {
    if (isAutoplayActive) {
      window.stopContinuousAutoplay();
    } else {
      window.startContinuousAutoplay();
    }
  };

  window.startContinuousAutoplay = function() {
    autoplayQueue = buildAutoplayQueue();
    if (!autoplayQueue.length) {
      showVoiceToast("⚠️ 현재 화면에 재생할 수 있는 캐릭터 카드가 없습니다.");
      return;
    }

    isAutoplayActive = true;
    autoplayIndex = 0;
    updateAutoplayButton(true);
    playNextInAutoplay();
  };

  window.stopContinuousAutoplay = function() {
    isAutoplayActive = false;
    updateAutoplayButton(false);
    if (activeAudio) {
      activeAudio.onended = null;
      activeAudio.pause();
    }
    if (currentPlayingCharId) {
      updateCharButtonState(currentPlayingCharId, false);
      resetCharProgress(currentPlayingCharId);
    }
    document.querySelectorAll(".card.autoplay-active").forEach(el => el.classList.remove("autoplay-active"));
    showVoiceToast("⏹ [연속 재생 정지]");
  };

  window.skipToNextInAutoplay = function() {
    if (!isAutoplayActive) {
      // 연속 재생이 꺼져 있을 때 누르면: 현재 재생 중인 카드 다음 카드부터 연속 재생 시작
      autoplayQueue = buildAutoplayQueue();
      if (!autoplayQueue.length) {
        showVoiceToast("⚠️ 재생 가능한 음성이 있는 카드가 없습니다.");
        return;
      }
      let targetIdx = 0;
      if (currentPlayingCharId) {
        const curIdx = autoplayQueue.findIndex(item => item.charId === currentPlayingCharId);
        if (curIdx >= 0) {
          targetIdx = (curIdx + 1) % autoplayQueue.length;
        }
      }
      isAutoplayActive = true;
      autoplayIndex = targetIdx;
      updateAutoplayButton(true);
      playNextInAutoplay();
      return;
    }

    // 연속 재생 중일 때: 현재 오디오 즉시 멈추고 다음 캐릭터로 스킵
    if (activeAudio) {
      activeAudio.onended = null;
      activeAudio.pause();
    }

    if (autoplayIndex < autoplayQueue.length) {
      const curItem = autoplayQueue[autoplayIndex];
      if (curItem) {
        updateCharButtonState(curItem.charId, false);
        resetCharProgress(curItem.charId);
        curItem.cardEl.classList.remove("autoplay-active");
      }
    }

    autoplayIndex++;
    if (autoplayIndex >= autoplayQueue.length) {
      window.stopContinuousAutoplay();
      showVoiceToast("🎉 [연속 재생 완료] 현재 페이지 모든 캐릭터의 시연이 끝났습니다.");
    } else {
      playNextInAutoplay();
    }
  };

  function updateAutoplayButton(active) {
    const btn = $("#btn-autoplay-continuous");
    if (!btn) return;
    if (active) {
      btn.innerHTML = `⏸ 연속 재생 정지 (${autoplayIndex + 1}/${autoplayQueue.length})`;
      btn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
      btn.style.boxShadow = "0 4px 14px rgba(239, 68, 68, 0.5)";
    } else {
      btn.innerHTML = `📻 50명 연속 재생 (자동 넘김)`;
      btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
      btn.style.boxShadow = "0 4px 14px rgba(16, 185, 129, 0.4)";
    }
  }

  function playNextInAutoplay() {
    if (!isAutoplayActive) return;

    if (autoplayIndex >= autoplayQueue.length) {
      isAutoplayActive = false;
      updateAutoplayButton(false);
      document.querySelectorAll(".card.autoplay-active").forEach(el => el.classList.remove("autoplay-active"));
      showVoiceToast("🎉 [연속 재생 완료] 현재 페이지 50명 전원의 음성 재생이 끝났습니다.");
      return;
    }

    const item = autoplayQueue[autoplayIndex];
    document.querySelectorAll(".card.autoplay-active").forEach(el => el.classList.remove("autoplay-active"));
    item.cardEl.classList.add("autoplay-active");
    item.cardEl.scrollIntoView({ behavior: "smooth", block: "center" });

    const introTag = item.hasIntro ? ' <span style="color:#34d399; font-weight:800;">[1군 실전 연기]</span>' : '';
    showVoiceToast(`📻 [연속 ${autoplayIndex + 1}/${autoplayQueue.length}] <strong>${item.charId}</strong> · ${item.actorName} 성우${introTag}`);

    window.playVoiceSampleDirect(item.charId, item.actorName, item.audioUrl, item.btn);

    if (activeAudio) {
      activeAudio.onended = () => {
        updateCharButtonState(item.charId, false);
        resetCharProgress(item.charId);
        item.cardEl.classList.remove("autoplay-active");
        if (isAutoplayActive) {
          autoplayIndex++;
          setTimeout(playNextInAutoplay, 450);
        }
      };
    }
  }

  window.playVoiceSample = function(voiceId, actorName, charId) {
    const sm = charId ? studiomonkeyMappings[charId] : null;
    const url = sm?.matched_voice?.audio_url || "https://studiomonkey.co.kr/uploads/samples/sample_2520_1763220530_69189c32e3fa0.mp3";
    window.playVoiceSampleDirect(charId || "CHR-001", actorName, url, null);
  };

  function showVoiceToast(msg) {
    let toast = document.getElementById("voice-player-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "voice-player-toast";
      toast.style.cssText = "position: fixed; bottom: 24px; right: 28px; z-index: 9999; background: #0f172a; border: 1px solid #6366f1; color: #e2e8f0; padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; box-shadow: 0 10px 25px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 8px;";
      document.body.appendChild(toast);
    }
    toast.innerHTML = msg;
    toast.style.display = "flex";
  }

  function indexDna(data, seatKey, seatRecords) {
    if (data?.schema !== "Horizon-Character-DNA-v1.0" || (data.seat_key || data.seat) !== seatKey || !Array.isArray(data.records)) {
      throw new Error("DNA JSON 스키마·좌석·records 형식 불일치");
    }
    const catalogIds = new Set(seatRecords.map(r => r.character_id));
    const counts = new Map();
    data.records.forEach(d => {
      if (typeof d?.character_id === "string") counts.set(d.character_id, (counts.get(d.character_id) || 0) + 1);
    });
    const joined = Object.create(null);
    const accepted = [];
    let invalid = 0, duplicates = 0, orphans = 0;
    data.records.forEach(d => {
      if (!d || typeof d.character_id !== "string" || !/^CHR-\d{3,}$/.test(d.character_id) ||
          ![d.past_history, d.relationship_hooks, d.visual_memory].every(Array.isArray)) {
        invalid += 1;
        return;
      }
      if (counts.get(d.character_id) !== 1) { duplicates += 1; return; }
      accepted.push(d);
      if (catalogIds.has(d.character_id)) joined[d.character_id] = d;
      else orphans += 1;
    });
    return { joined, fileCount: accepted.length, archetypes: accepted.filter(d => archetypeCodes.has(d.archetype?.primary_code)).length,
      matched: Object.keys(joined).length, missing: catalogIds.size - Object.keys(joined).length, duplicates, invalid, orphans };
  }

  async function fetchSeatDna(seatKey) {
    const path = `/aistory/data/character-profiles_${seatKey}.json`;
    try {
      const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404 ? `파일 미도착 (HTTP 404): ${path}` : `HTTP ${response.status}: ${path}`);
      let data;
      try { data = await response.json(); }
      catch (error) { throw new Error(`JSON 파싱 오류: ${path} — ${error.message}`); }
      return { data };
    } catch (error) {
      return { error: error.message };
    }
  }

  async function loadSeat(seatKey) {
    if (!fleetSeats.has(seatKey)) return;
    const version = ++seatLoadVersion;
    const isCurrent = () => version === seatLoadVersion;
    currentSeat = seatKey;
    try { localStorage.setItem("characterReviewSeat", seatKey); } catch(e) {}
    // Clear before the first await: no previous seat's DNA, review state or modal can leak.
    records = [];
    humanReviews = {};
    dnaProfiles = Object.create(null);
    promptMetadata = Object.create(null);
    promptMetadataSummary = null;
    currentPage = 1;
    $("#viewer").close();
    $("#modal-dna").innerHTML = "";
    if ($("#modal-prompts")) $("#modal-prompts").innerHTML = "";
    $("#modal-title").textContent = "캐릭터 상세";
    $("#modal-color").removeAttribute("src");
    $("#modal-ink").removeAttribute("src");
    ["#total-count", "#auto-pass", "#auto-warn", "#auto-fail", "#dna-count", "#archetype-count"].forEach(s => $(s).textContent = "0");
    $("#dna-status").textContent = `${seatKey.toUpperCase()} DNA 불러오는 중…`;
    $("#dna-status").dataset.state = "loading";
    $("#seat-notice").textContent = "좌석 정본 불러오는 중…";
    $("#db-status-badge").textContent = "Titan DB 조회 중…";
    $("#export").disabled = true;
    render();
    $("#grid").innerHTML = '<p class="empty">좌석 정본 및 DB 동기화 데이터를 불러오는 중입니다...</p>';
    
    // Update Tab UI
    document.querySelectorAll(".fleet-tab").forEach(tab => {
      if (tab.dataset.seat === seatKey) tab.classList.add("active");
      else tab.classList.remove("active");
    });

    try {
      // 1. Fetch seat catalog JSON
      const [res, dnaResult] = await Promise.all([
        fetch(`/aistory/data/characters_563_review_${seatKey}.json?v=${Date.now()}`, { cache: "no-store" }),
        fetchSeatDna(seatKey)
      ]);
      if (!isCurrent()) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (!isCurrent()) return;
      if (!Array.isArray(payload.records)) throw new Error("캐릭터 정본 records 형식 오류");
      records = payload.records;
      try {
        const promptRes = await fetch(`/aistory/data/character-prompts_${seatKey}.json?v=${Date.now()}`, { cache: "no-store" });
        if (!promptRes.ok) throw new Error(`HTTP ${promptRes.status}`);
        const promptPayload = await promptRes.json();
        if (!Array.isArray(promptPayload.records)) throw new Error("records 형식 오류");
        promptMetadata = Object.fromEntries(promptPayload.records.map(item => [item.character_id, item]));
        promptMetadataSummary = promptPayload.counts || null;
      } catch (error) {
        promptMetadata = Object.create(null);
        promptMetadataSummary = { error: error.message };
      }
      try {
        if (dnaResult.error) throw new Error(dnaResult.error);
        const dna = indexDna(dnaResult.data, seatKey, records);
        dnaProfiles = dna.joined;
        $("#dna-count").textContent = dna.fileCount;
        $("#archetype-count").textContent = dna.archetypes;
        const warning = dna.missing || dna.orphans || dna.invalid || dna.duplicates || dna.archetypes !== dna.fileCount;
        $("#dna-status").dataset.state = warning ? "warning" : "ready";
        $("#dna-status").textContent = `${warning ? "⚠ " : ""}${seatKey.toUpperCase()} DNA 파일 ${dna.fileCount}건 · 원형 매핑 ${dna.archetypes}건 · 카드 ID 결합 ${dna.matched}/${records.length}` +
          (warning ? ` · DNA 미도착 ${dna.missing} · 정본 ID 미대응 ${dna.orphans} · 중복 레코드 ${dna.duplicates} · 형식 제외 ${dna.invalid}` : "");
      } catch (error) {
        $("#dna-status").dataset.state = "error";
        $("#dna-status").textContent = `⚠ ${seatKey.toUpperCase()} DNA 0건 — ${error.message}. 이미지와 사람 검수는 계속 이용할 수 있습니다.`;
      }

      // Update Summary Header
      $("#total-count").textContent = payload.summary.total;
      $("#auto-pass").textContent = payload.summary.pass;
      $("#auto-warn").textContent = payload.summary.warn;
      $("#auto-fail").textContent = payload.summary.fail;
      $("#seat-notice").innerHTML = `
        <strong>${payload.summary.master_name}</strong>: ${payload.summary.description} 
        (등록 ${payload.summary.total}종. DNA ${records.filter(r => dnaProfiles[r.character_id]).length}종 연결. 공개 경량 열람본입니다.)
      `;

      // 2. Fetch Human Reviews from Titan DB API
      try {
        const dbRes = await fetch(`/aistory/api/save_review.asp?seat_key=${seatKey}&v=${Date.now()}`);
        if (!isCurrent()) return;
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          if (!isCurrent()) return;
          humanReviews = dbData.reviews || {};
          $("#db-status-badge").textContent = "공개 열람 모드";
        } else {
          humanReviews = {};
        }
      } catch (dbe) {
        if (!isCurrent()) return;
        humanReviews = {};
        $("#db-status-badge").textContent = "공개 열람 모드";
      }

      currentPage = 1;
      $("#export").disabled = false;
      render();
    } catch (e) {
      if (!isCurrent()) return;
      $("#grid").innerHTML = `<p class="empty">좌석 데이터 로드 실패: ${esc(e.message)}</p>`;
      $("#dna-status").dataset.state = "error";
      $("#dna-status").textContent = `⚠ ${seatKey.toUpperCase()} 정본 로드 실패 — ${e.message}`;
    }
  }

  async function init() {
    // Attach Seat switcher tab events
    document.querySelectorAll(".fleet-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        loadSeat(tab.dataset.seat);
      });
    });

    ["#search", "#auto-filter", "#review-filter", "#archetype-filter"].forEach((s) => 
      $(s).addEventListener("input", () => { currentPage = 1; render(); })
    );
    $("#clean-voice-filter")?.addEventListener("change", () => { currentPage = 1; render(); });
    $("#btn-autoplay-continuous")?.addEventListener("click", window.toggleContinuousAutoplay);
    $("#btn-autoplay-next")?.addEventListener("click", window.skipToNextInAutoplay);
    $("#export").addEventListener("click", exportReview);
    $("#close-modal").addEventListener("click", () => $("#viewer").close());
    $("#prev-page").addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage -= 1;
        render();
        scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    $("#next-page").addEventListener("click", () => {
      currentPage += 1;
      render();
      scrollTo({ top: 0, behavior: "smooth" });
    });

    // Load Studio Monkey 563 Voice Mappings
    try {
      const smRes = await fetch(`/aistory/data/characters_563_studiomonkey_mapping.json?v=${Date.now()}`);
      if (smRes.ok) {
        const smData = await smRes.json();
        (smData.mappings || []).forEach(m => {
          studiomonkeyMappings[m.character_id] = m;
        });
      }
    } catch(e) {
      console.warn("Studio Monkey mapping fetch error:", e);
    }

    // Load 563 Characters Intro Manifest (Fish Audio S2.1 Pro 실전 연기 음원)
    try {
      const introRes = await fetch(`/aistory/data/characters_563_intro_manifest.json?v=${Date.now()}`);
      if (introRes.ok) {
        const introData = await introRes.json();
        (introData.characters || []).forEach(c => {
          introManifest[c.character_id] = c;
        });
      }
    } catch(e) {
      console.warn("Intro manifest fetch error:", e);
    }

    // Initial load: Atlas
    loadSeat(currentSeat);
    // Public static archive: live production progress polling disabled.
  }

  async function refreshProgress() {
    try {
      const pRes = await fetch(`/aistory/api/get_production_progress.asp?v=${Date.now()}`);
      if (pRes.ok) {
        const pData = await pRes.json();
        let nv = null;
        try { const vr = await fetch(`/aistory/data/nova-verification-progress.json?v=${Date.now()}`, {cache:"no-store"}); if(vr.ok) nv = await vr.json(); } catch(e) {}
        if (pData.seats) {
          document.querySelectorAll(".fleet-tab").forEach(tab => {
            const sk = tab.dataset.seat;
            const sInfo = pData.seats[sk];
            if (sInfo) {
              const subEl = tab.querySelector(".tab-sub");
              if (subEl) {
                const color = sInfo.pct >= 100 ? "#54d6a1" : "#f3c85a";
                subEl.innerHTML = `${sInfo.master_name.split(' ')[0]} · <strong style="color:${color};">${sInfo.produced}/${sInfo.target} (${sInfo.pct}%)</strong>`;
                if(sk === "nova") {
                  subEl.innerHTML = `등록 ${nv && Number.isInteger(nv.registered) ? nv.registered : sInfo.produced}/${sInfo.target} · ${nv && Number.isInteger(nv.registered_dual_pairs) ? "배포 듀얼" : "생산장부 듀얼"} ${nv && Number.isInteger(nv.registered_dual_pairs) ? nv.registered_dual_pairs : nv ? nv.local_dual_candidates : "미확인"}/${sInfo.target}<br>DNA ${nv ? nv.dna_cards : "미확인"}/${sInfo.target} · <strong style="color:#f3c85a;">7게이트 ${nv ? nv.final_certified : "미확인"}/${sInfo.target}</strong>`;
                }
              }
            }
          });
        }
      }
    } catch(e) {}
  }

  document.addEventListener("DOMContentLoaded", init);
})();

