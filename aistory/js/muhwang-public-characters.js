(function () {
  "use strict";

  const DATA_URL = "/aistory/data/muhwang-public-characters.json?v=public-gallery-20261028";
  const PAGE_SIZE = 30;
  const tierColors = {LEAD:"#d05a42",TIER1:"#c6a15b",SUPPORT:"#7398b8",EXTRA:"#7f8b78"};
  let records = [];
  let currentPage = 1;

  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[char]);
  const nameText = (record) => record.aliases?.length ? `${record.name} · ${record.aliases.join(" · ")}` : record.name;
  const volumeText = (record) => {
    if (!record.volumes?.length) return "등장 권 미기록";
    if (record.first_volume === record.last_volume) return `${record.first_volume}권`;
    return `${record.first_volume}-${record.last_volume}권`;
  };

  function filtered() {
    const term = $("#search").value.trim().toLowerCase();
    const tier = $("#tier-filter").value;
    const volume = Number($("#volume-filter").value || 0);
    return records.filter((record) => {
      const blob = [record.character_id,record.name,...(record.aliases||[]),record.tier_label,record.summary,record.appeal].join(" ").toLowerCase();
      return (!term || blob.includes(term)) && (!tier || record.tier === tier) && (!volume || record.volumes?.includes(volume));
    });
  }

  function card(record) {
    const summary = record.summary || record.appeal || "47권 원문 기반 캐릭터";
    return `
      <article class="card character-card" style="--tier-color:${tierColors[record.tier] || "#c6a15b"}" data-char-id="${esc(record.character_id)}">
        <div class="card-top">
          <a class="portrait-placeholder portrait-ready sheet-thumb" href="${esc(record.color_url)}" target="_blank" rel="noopener" aria-label="${esc(record.name)} ${esc(record.image_label)} 새 창으로 보기">
            <img loading="lazy" src="${esc(record.color_url)}" alt="${esc(record.name)} ${esc(record.image_label)}" onerror="this.src='/aistory/assets/menu/muhwang-character-sheet.png'">
          </a>
          <div>
            <span class="card-id">${esc(record.character_id)}</span>
            <h3>${esc(record.name)}</h3>
            ${record.aliases?.length ? `<span class="name-hanja">${esc(record.aliases.join(" · "))}</span>` : ""}
            <div class="badges"><span class="badge primary">${esc(record.tier_label)}</span><span class="badge">${esc(volumeText(record))}</span><span class="badge">${record.ink_url ? "컬러+먹선" : "대표 이미지"}</span></div>
          </div>
        </div>
        <div class="card-body">
          <p>${esc(summary)}</p>
          ${record.appeal && record.appeal !== summary ? `<p class="lock-line">${esc(record.appeal)}</p>` : ""}
          <div class="facts">
            <div><strong>${record.volumes?.length || 0}</strong><span>등장 권</span></div>
            <div><strong>${Number(record.speaker_lines || 0).toLocaleString("ko-KR")}</strong><span>대사</span></div>
            <div><strong>${Number(record.narrative_mentions || 0).toLocaleString("ko-KR")}</strong><span>언급</span></div>
          </div>
          <div class="card-actions">
            <button class="detail-open" type="button" data-open="${esc(record.character_id)}">캐릭터 상세</button>
            <a class="sheet-link" href="${esc(record.color_url)}" target="_blank" rel="noopener">${esc(record.image_label)}</a>
            ${record.ink_url ? `<a class="sheet-link" href="${esc(record.ink_url)}" target="_blank" rel="noopener">먹선 시트</a>` : ""}
          </div>
        </div>
      </article>`;
  }

  function pageButton(page) {
    return `<button type="button" class="detail-open" data-page="${page}" ${page === currentPage ? 'aria-current="page" style="border-color:var(--gold);color:#fff3d4"' : ""}>${page}</button>`;
  }

  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, pages);
    const current = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    $("#catalog").innerHTML = current.length ? current.map(card).join("") : '<p class="empty">조건에 맞는 캐릭터가 없습니다.</p>';
    $("#result-count").textContent = `${list.length}명 · ${currentPage}/${pages}페이지`;
    $("#page-info").textContent = `${currentPage} / ${pages}`;
    $("#prev-page").disabled = currentPage === 1;
    $("#next-page").disabled = currentPage === pages;

    const start = Math.floor((currentPage - 1) / 10) * 10 + 1;
    const end = Math.min(start + 9, pages);
    const parts = [];
    if (start > 1) parts.push(pageButton(1));
    for (let page = start; page <= end; page += 1) parts.push(pageButton(page));
    if (end < pages) parts.push(pageButton(pages));
    $("#page-buttons").innerHTML = parts.join("");

    document.querySelectorAll("[data-open]").forEach((element) => element.addEventListener("click", () => openDetail(element.dataset.open)));
    document.querySelectorAll("[data-page]").forEach((element) => element.addEventListener("click", () => {currentPage=Number(element.dataset.page);render();scrollTo({top:0,behavior:"smooth"});}));
  }

  function openDetail(id) {
    const record = records.find((item) => item.character_id === id);
    if (!record) return;
    $("#dialog-title").textContent = nameText(record);
    const images = [`<a class="detail-image-link" href="${esc(record.color_url)}" target="_blank" rel="noopener"><img class="detail-production-image" src="${esc(record.color_url)}" alt="${esc(record.name)} ${esc(record.image_label)}"><span>${esc(record.image_label)} 원본 보기</span></a>`];
    if (record.ink_url) images.push(`<a class="detail-image-link" href="${esc(record.ink_url)}" target="_blank" rel="noopener"><img class="detail-production-image" src="${esc(record.ink_url)}" alt="${esc(record.name)} 먹선 시트"><span>먹선 시트 원본 보기</span></a>`);
    $("#dialog-images").innerHTML = images.join("");
    $("#dialog-info").innerHTML = `
      <h3>${esc(record.character_id)} · ${esc(record.tier_label)}</h3>
      ${record.summary ? `<p>${esc(record.summary)}</p>` : ""}
      ${record.appeal ? `<p>${esc(record.appeal)}</p>` : ""}
      <div class="facts">
        <div><strong>${record.volumes?.length || 0}</strong><span>등장 권</span></div>
        <div><strong>${Number(record.speaker_lines || 0).toLocaleString("ko-KR")}</strong><span>대사</span></div>
        <div><strong>${Number(record.narrative_mentions || 0).toLocaleString("ko-KR")}</strong><span>언급</span></div>
      </div>
      <p><b>등장 권차:</b> ${record.volumes?.length ? record.volumes.map(v=>`${v}권`).join(", ") : "미기록"}</p>`;
    $("#viewer").showModal();
  }

  function buildFilters() {
    const tiers = new Map();
    records.forEach((record) => {if(record.tier)tiers.set(record.tier,record.tier_label)});
    $("#tier-filter").innerHTML = '<option value="">전체 등급</option>' + [...tiers].map(([code,label])=>`<option value="${esc(code)}">${esc(label)}</option>`).join("");
    $("#volume-filter").innerHTML = '<option value="">전 47권</option>' + Array.from({length:47},(_,i)=>`<option value="${i+1}">제${i+1}권</option>`).join("");
  }

  async function init() {
    try {
      const response = await fetch(DATA_URL,{cache:"no-store"});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if(!Array.isArray(payload.records))throw new Error("공개 캐릭터 데이터 형식 오류");
      records=payload.records;
      buildFilters();
      $("#metric-total").textContent=records.length;
      $("#metric-color").textContent=records.filter(r=>r.color_url).length;
      $("#metric-ink").textContent=records.filter(r=>r.ink_url).length;
      $("#metric-tiers").textContent=new Set(records.map(r=>r.tier).filter(Boolean)).size;
      $("#archive-status").textContent=`공개 캐릭터 ${records.length}명`;
      render();
    } catch(error) {
      $("#catalog").innerHTML='<p class="empty">공개 캐릭터 자료를 불러오지 못했습니다.</p>';
      $("#result-count").textContent=`자료 로드 실패: ${error.message}`;
      $("#archive-status").textContent="자료 로드 실패";
    }
  }

  $("#search").addEventListener("input",()=>{currentPage=1;render()});
  $("#tier-filter").addEventListener("change",()=>{currentPage=1;render()});
  $("#volume-filter").addEventListener("change",()=>{currentPage=1;render()});
  $("#prev-page").addEventListener("click",()=>{if(currentPage>1){currentPage-=1;render();scrollTo({top:0,behavior:"smooth"})}});
  $("#next-page").addEventListener("click",()=>{currentPage+=1;render();scrollTo({top:0,behavior:"smooth"})});
  $("#dialog-close").addEventListener("click",()=>$("#viewer").close());
  $("#viewer").addEventListener("click",(event)=>{if(event.target===$("#viewer"))$("#viewer").close()});
  init();
})();
