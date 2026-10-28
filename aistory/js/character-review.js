(function () {
  "use strict";

  const DATA_URL = "/aistory/data/samadal-public-characters.json?v=public-sanitized-20261028";
  const PAGE_SIZE = 50;
  let records = [];
  let currentPage = 1;

  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[char]);
  const displayName = (record) => record.alias && record.alias !== record.canonical_name_ko
    ? `${record.canonical_name_ko} · ${record.alias}`
    : record.canonical_name_ko;

  function filteredRecords() {
    const term = $("#search").value.trim().toLowerCase();
    const archetype = $("#archetype-filter").value;
    return records.filter((record) => {
      const blob = [
        record.character_id,
        record.canonical_name_ko,
        record.romanized,
        record.alias,
        record.role_tag,
        record.archetype?.korean_label,
        record.one_line,
        record.signature_skill,
        record.weakness
      ].join(" ").toLowerCase();
      return (!term || blob.includes(term)) && (!archetype || record.archetype?.primary_code === archetype);
    });
  }

  function card(record) {
    const skill = record.signature_skill ? `<dt>주특기</dt><dd>${esc(record.signature_skill)}</dd>` : "";
    const weakness = record.weakness ? `<dt>약점</dt><dd>${esc(record.weakness)}</dd>` : "";
    return `
      <article class="card" data-char-id="${esc(record.character_id)}">
        <div class="thumb" data-open="${esc(record.character_id)}">
          <img loading="lazy" src="${esc(record.color_url || record.ink_url)}" alt="${esc(record.character_id)} ${esc(record.canonical_name_ko)}" onerror="this.src='/aistory/assets/menu/samadal-character-sheet.png'">
          <span class="badge">${record.queue_index || ""} · ${esc(record.character_id)}</span>
        </div>
        <div class="body">
          <div class="title-row"><h2>${esc(displayName(record))}</h2></div>
          <p class="role">${esc(record.role_tag)}</p>
          <div class="dna-brief">
            <span class="dna-id">${esc(record.character_id)}${record.romanized ? ` · ${esc(record.romanized)}` : ""}</span>
            ${record.archetype?.korean_label ? `<span class="archetype-chip">${esc(record.archetype.korean_label)}</span>` : ""}
            ${record.one_line ? `<p>${esc(record.one_line)}</p>` : ""}
            ${(skill || weakness) ? `<dl>${skill}${weakness}</dl>` : ""}
          </div>
          <div class="links">
            <a href="${esc(record.color_url || "#")}" target="_blank" rel="noopener">컬러 보기</a>
            <a href="${esc(record.ink_url || "#")}" target="_blank" rel="noopener">먹선 보기</a>
          </div>
        </div>
      </article>`;
  }

  function pageButton(page) {
    return `<button type="button" data-page="${page}" class="${page === currentPage ? "active" : ""}" ${page === currentPage ? 'aria-current="page"' : ""}>${page}</button>`;
  }

  function render() {
    const list = filteredRecords();
    const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, pageCount);
    const start = (currentPage - 1) * PAGE_SIZE;
    const current = list.slice(start, start + PAGE_SIZE);

    $("#visible-count").textContent = list.length;
    $("#grid").innerHTML = current.length ? current.map(card).join("") : '<p class="empty">조건에 맞는 캐릭터가 없습니다.</p>';
    $("#page-info").textContent = `${currentPage} / ${pageCount} · 총 ${list.length}명`;

    const windowSize = 10;
    const windowStart = Math.floor((currentPage - 1) / windowSize) * windowSize + 1;
    const windowEnd = Math.min(windowStart + windowSize - 1, pageCount);
    const parts = [];
    if (windowStart > 1) {
      parts.push(pageButton(1));
      if (windowStart > 2) parts.push('<span class="page-ellipsis">· · ·</span>');
    }
    for (let page = windowStart; page <= windowEnd; page += 1) parts.push(pageButton(page));
    if (windowEnd < pageCount) {
      if (windowEnd < pageCount - 1) parts.push('<span class="page-ellipsis">· · ·</span>');
      parts.push(pageButton(pageCount));
    }
    $("#page-buttons").innerHTML = parts.join("");
    $("#prev-page").disabled = currentPage === 1;
    $("#next-page").disabled = currentPage === pageCount;

    document.querySelectorAll("[data-open]").forEach((element) => element.addEventListener("click", () => openDetail(element.dataset.open)));
    document.querySelectorAll("#page-buttons [data-page]").forEach((element) => element.addEventListener("click", () => {
      currentPage = Number(element.dataset.page);
      render();
      scrollTo({top: 0, behavior: "smooth"});
    }));
  }

  function openDetail(id) {
    const record = records.find((item) => item.character_id === id);
    if (!record) return;
    $("#modal-title").textContent = `${displayName(record)} (${record.character_id})`;
    $("#modal-color").src = record.color_url || "";
    $("#modal-ink").src = record.ink_url || "";
    $("#modal-public").innerHTML = `
      <header>
        <span class="dna-kicker">PUBLIC CHARACTER ARCHIVE</span>
        <h2>${esc(displayName(record))}</h2>
        ${record.romanized ? `<p>${esc(record.romanized)}</p>` : ""}
        ${record.one_line ? `<blockquote>${esc(record.one_line)}</blockquote>` : ""}
      </header>
      <dl>
        <dt>배역</dt><dd>${esc(record.role_tag || "캐릭터")}</dd>
        ${record.archetype?.korean_label ? `<dt>캐릭터 원형</dt><dd>${esc(record.archetype.korean_label)}</dd>` : ""}
        ${record.signature_skill ? `<dt>주특기</dt><dd>${esc(record.signature_skill)}</dd>` : ""}
        ${record.weakness ? `<dt>약점</dt><dd>${esc(record.weakness)}</dd>` : ""}
      </dl>`;
    $("#viewer").showModal();
  }

  function buildArchetypeFilter() {
    const options = new Map();
    records.forEach((record) => {
      const code = record.archetype?.primary_code;
      const label = record.archetype?.korean_label;
      if (code && label) options.set(code, label);
    });
    $("#archetype-filter").innerHTML = '<option value="">캐릭터 원형 전체</option>' +
      [...options.entries()].sort((a, b) => a[1].localeCompare(b[1], "ko")).map(([code, label]) => `<option value="${esc(code)}">${esc(label)}</option>`).join("");
  }

  async function init() {
    try {
      const response = await fetch(DATA_URL, {cache: "no-store"});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.records)) throw new Error("공개 캐릭터 형식 오류");
      records = payload.records;
      buildArchetypeFilter();
      $("#total-count").textContent = records.length;
      $("#color-count").textContent = records.filter((record) => record.color_url).length;
      $("#ink-count").textContent = records.filter((record) => record.ink_url).length;
      $("#archetype-count").textContent = new Set(records.map((record) => record.archetype?.primary_code).filter(Boolean)).size;
      $("#archive-status").textContent = `공개 캐릭터 ${records.length}명`;
      $("#archive-message").textContent = `사마달 공개 캐릭터 ${records.length}명을 불러왔습니다.`;
      render();
    } catch (error) {
      $("#archive-message").textContent = `공개 캐릭터 자료를 불러오지 못했습니다: ${error.message}`;
      $("#grid").innerHTML = '<p class="empty">공개 캐릭터 자료를 불러오지 못했습니다.</p>';
    }
  }

  $("#search").addEventListener("input", () => { currentPage = 1; render(); });
  $("#archetype-filter").addEventListener("change", () => { currentPage = 1; render(); });
  $("#prev-page").addEventListener("click", () => { if (currentPage > 1) { currentPage -= 1; render(); scrollTo({top: 0, behavior: "smooth"}); } });
  $("#next-page").addEventListener("click", () => { currentPage += 1; render(); scrollTo({top: 0, behavior: "smooth"}); });
  $("#close-modal").addEventListener("click", () => $("#viewer").close());
  $("#viewer").addEventListener("click", (event) => { if (event.target === $("#viewer")) $("#viewer").close(); });

  init();
})();
