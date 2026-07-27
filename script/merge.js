function parseEntries(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const entries = [];

  for (const line of lines) {
    let matched = false;

    // Splitter-style format: Player - @code - number - percent - Category
    const parts = line.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 5) {
      const codeRaw = parts[parts.length - 4];
      const category = parts[parts.length - 1];
      const player = parts.slice(0, parts.length - 4).join(' - ');
      if (/^@?\d+$/.test(codeRaw)) {
        entries.push({ code: codeRaw.replace(/^@/, ''), player, category });
        matched = true;
      }
    }

    // @-prefixed codes anywhere in the line (CSV rows with extra columns, no player/category)
    if (!matched) {
      const atMatches = line.match(/@\d+/g);
      if (atMatches) {
        for (const m of atMatches) entries.push({ code: m.slice(1), player: null, category: null });
        matched = true;
      }
    }

    // plain list: a whole comma-separated token that is only digits
    if (!matched) {
      const tokens = line.split(',').map(t => t.trim());
      for (const token of tokens) {
        if (/^\d+$/.test(token)) entries.push({ code: token, player: null, category: null });
      }
    }
  }

  return entries;
}

function mergeEntries(allEntries) {
  const merged = new Map();
  for (const entry of allEntries) {
    if (!merged.has(entry.code)) {
      merged.set(entry.code, { player: entry.player, category: entry.category });
    } else {
      const existing = merged.get(entry.code);
      if (existing.player == null && entry.player != null) existing.player = entry.player;
      if (existing.category == null && entry.category != null) existing.category = entry.category;
    }
  }
  return merged;
}

function groupMerged(merged) {
  const grouped = new Map();
  for (const [code, info] of merged) {
    const playerKey = info.player || 'No author';
    const categoryKey = info.category || 'No category';
    if (!grouped.has(playerKey)) grouped.set(playerKey, new Map());
    const cats = grouped.get(playerKey);
    if (!cats.has(categoryKey)) cats.set(categoryKey, []);
    cats.get(categoryKey).push(code);
  }
  return grouped;
}

function buildGroupCopyText(name, categories) {
  let text = `${name} maps:\n`;
  for (const [category, codes] of categories) {
    text += `${category}: ${codes.join(', ')}\n`;
  }
  return text.trim();
}

/* ---------- list slots ---------- */

let slotCounter = 2;

function wireSlot(slotEl) {
  const modeButtons = slotEl.querySelectorAll('.mode-btn[data-input-mode]');
  const textarea = slotEl.querySelector('.list-slot__textarea');
  const fileDrop = slotEl.querySelector('.list-slot__filedrop');
  const fileInput = slotEl.querySelector('.list-slot__fileinput');
  const fileName = slotEl.querySelector('.file-drop__name');
  const removeBtn = slotEl.querySelector('.list-slot__remove');

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.inputMode;
      textarea.hidden = mode !== 'paste';
      fileDrop.hidden = mode !== 'upload';
    });
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileName.textContent = file ? file.name : 'No file chosen';
    slotEl._fileText = file ? await readFileAsText(file) : '';
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      slotEl.remove();
      renumberSlots();
    });
  }
}

function renumberSlots() {
  const slots = document.querySelectorAll('.list-slot');
  slots.forEach((slot, index) => {
    slot.querySelector('.list-slot__title').textContent = `List ${index + 1}`;
  });
}

function createSlot(id) {
  const slot = document.createElement('div');
  slot.className = 'list-slot';
  slot.dataset.slotId = String(id);
  slot.innerHTML = `
    <div class="list-slot__head">
      <span class="list-slot__title">List</span>
      <div class="mode-toggle small" role="radiogroup" aria-label="List input mode">
        <button type="button" class="mode-btn active" data-input-mode="paste">Paste text</button>
        <button type="button" class="mode-btn" data-input-mode="upload">Upload file</button>
      </div>
      <button type="button" class="list-slot__remove" title="Remove this list" aria-label="Remove this list">&times;</button>
    </div>
    <textarea class="list-slot__textarea" placeholder="Paste a map list here..."></textarea>
    <div class="file-drop list-slot__filedrop" hidden>
      <input type="file" class="list-slot__fileinput" accept=".csv,.txt,text/csv,text/plain" />
      <span class="file-drop__name">No file chosen</span>
    </div>
  `;
  wireSlot(slot);
  return slot;
}

document.querySelectorAll('.list-slot').forEach(wireSlot);

document.getElementById('add-list-btn').addEventListener('click', () => {
  slotCounter++;
  const slot = createSlot(slotCounter);
  document.getElementById('list-slots').appendChild(slot);
  renumberSlots();
});

function getSlotText(slotEl) {
  const activeBtn = slotEl.querySelector('.mode-btn.active');
  const mode = activeBtn ? activeBtn.dataset.inputMode : 'paste';
  if (mode === 'upload') return slotEl._fileText || '';
  const textarea = slotEl.querySelector('.list-slot__textarea');
  return textarea ? textarea.value : '';
}

/* ---------- output mode ---------- */

let groupMode = 'grouped';

document.querySelectorAll('.mode-btn[data-group-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('active')) return;
    document.querySelectorAll('.mode-btn[data-group-mode]').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-checked', 'true');
    groupMode = btn.dataset.groupMode;
  });
});

/* ---------- merge action ---------- */

document.getElementById('merge-btn').addEventListener('click', () => {
  const slots = document.querySelectorAll('.list-slot');
  const texts = [...slots].map(getSlotText).filter(t => t.trim());

  const statusEl = document.getElementById('merge-status');
  const resultsEl = document.getElementById('merge-results');
  const resultsHeading = document.getElementById('merge-results-heading');
  resultsHeading.textContent = groupMode === 'flat' ? 'Merged results (flat list)' : 'Merged results (by player + category)';

  if (!texts.length) {
    statusEl.textContent = 'Add at least one list to merge.';
    resultsEl.innerHTML = '<p class="empty-hint">The merged, duplicate-free list will appear here.</p>';
    document.getElementById('status-dot').classList.remove('active');
    ['stat-lists', 'stat-raw', 'stat-unique', 'stat-dupes'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    return;
  }

  const allEntries = texts.flatMap(parseEntries);
  const merged = mergeEntries(allEntries);

  document.getElementById('stat-lists').textContent = texts.length;
  document.getElementById('stat-raw').textContent = allEntries.length;
  document.getElementById('stat-unique').textContent = merged.size;
  document.getElementById('stat-dupes').textContent = allEntries.length - merged.size;
  document.getElementById('status-dot').classList.add('active');

  resultsEl.innerHTML = '';

  if (groupMode === 'flat') {
    const codes = [...merged.keys()];
    const card = document.createElement('div');
    card.className = 'player-card';

    const header = document.createElement('div');
    header.className = 'player-header';
    header.innerHTML = `
      <span class="player-name">🧀 Merged maps</span>
      <span class="player-meta">${codes.length} map(s)</span>
    `;
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-all-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.disabled = codes.length === 0;
    if (codes.length) copyBtn.addEventListener('click', () => copyText(codes.join(', '), copyBtn));
    header.appendChild(copyBtn);
    card.appendChild(header);

    const row = document.createElement('div');
    row.className = 'category-row';
    row.appendChild(buildCodesBlock(codes, 'No maps found.', { showCopy: false }));
    card.appendChild(row);
    resultsEl.appendChild(card);
    setupExpandable(row);
  } else {
    const grouped = groupMerged(merged);
    for (const [name, categories] of grouped) {
      const card = document.createElement('div');
      card.className = 'player-card';

      const mapCount = [...categories.values()].reduce((sum, arr) => sum + arr.length, 0);
      const isNoAuthor = name === 'No author';

      const header = document.createElement('div');
      header.className = 'player-header';
      header.innerHTML = `
        <span class="player-name">${isNoAuthor ? '❔' : '🐭'} ${escapeHtml(name)}</span>
        <span class="player-meta">${mapCount} map(s) · ${categories.size} categor${categories.size === 1 ? 'y' : 'ies'}</span>
      `;
      const copyAllBtn = document.createElement('button');
      copyAllBtn.className = 'copy-all-btn';
      copyAllBtn.textContent = 'Copy all';
      copyAllBtn.addEventListener('click', () => copyText(buildGroupCopyText(name, categories), copyAllBtn));
      header.appendChild(copyAllBtn);
      card.appendChild(header);

      appendCategoryRows(card, categories);
      resultsEl.appendChild(card);
    }
  }

  statusEl.textContent = `${texts.length} list(s) merged · ${merged.size} unique map(s) · ${allEntries.length - merged.size} duplicate(s) removed.`;
});
