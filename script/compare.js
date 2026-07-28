function extractCodes(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const codes = new Set();

  for (const line of lines) {
    let found = false;

    // Splitter-style format: Player - @code - number - percent - Category
    const parts = line.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 5) {
      const codeRaw = parts[parts.length - 4];
      if (/^@?\d+$/.test(codeRaw)) {
        codes.add(codeRaw.replace(/^@/, ''));
        found = true;
      }
    }

    // @-prefixed codes anywhere in the line (handles CSV rows with extra columns)
    if (!found) {
      const atMatches = line.match(/@\d+/g);
      if (atMatches) {
        for (const m of atMatches) codes.add(m.slice(1));
        found = true;
      }
    }

    // plain list: a whole comma-separated token that is only digits
    if (!found) {
      const tokens = line.split(',').map(t => t.trim());
      for (const token of tokens) {
        if (/^\d+$/.test(token)) codes.add(token);
      }
    }
  }

  return codes;
}

function renderCodesCard(container, title, codes, emptyMessage) {
  const card = document.createElement('div');
  card.className = 'player-card';

  const header = document.createElement('div');
  header.className = 'player-header';
  header.innerHTML = `
    <span class="player-name">${escapeHtml(title)}</span>
    <span class="player-meta">${codes.length} map(s)</span>
  `;
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-all-btn';
  copyBtn.textContent = 'Copy';
  copyBtn.disabled = codes.length === 0;
  if (codes.length) {
    copyBtn.addEventListener('click', () => copyText(codes.join(', '), copyBtn));
  }
  header.appendChild(copyBtn);
  card.appendChild(header);

  const row = document.createElement('div');
  row.className = 'category-row';
  row.appendChild(buildCodesBlock(codes, emptyMessage, { showCopy: false }));
  card.appendChild(row);
  container.appendChild(card);
  setupExpandable(row);
}

document.querySelectorAll('#compare-slots .list-slot').forEach(wireSlot);

document.getElementById('compare-btn').addEventListener('click', () => {
  const slots = document.querySelectorAll('#compare-slots .list-slot');
  const [slot1, slot2] = slots;
  const text1 = getSlotText(slot1).trim();
  const text2 = getSlotText(slot2).trim();

  const statusEl = document.getElementById('compare-status');
  const resultsEl = document.getElementById('compare-results');

  if (!text1 || !text2) {
    statusEl.textContent = 'Add content to both lists to compare.';
    resultsEl.innerHTML = '<p class="empty-hint">Repeated and not-repeated maps will appear here.</p>';
    document.getElementById('status-dot').classList.remove('active');
    ['stat-file1', 'stat-file2', 'stat-repeated', 'stat-unique'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    return;
  }

  const codesA = extractCodes(text1);
  const codesB = extractCodes(text2);

  const repeated = [...codesA].filter(c => codesB.has(c));
  const onlyA = [...codesA].filter(c => !codesB.has(c));
  const onlyB = [...codesB].filter(c => !codesA.has(c));
  const notRepeated = [...onlyA, ...onlyB];

  document.getElementById('stat-file1').textContent = codesA.size;
  document.getElementById('stat-file2').textContent = codesB.size;
  document.getElementById('stat-repeated').textContent = repeated.length;
  document.getElementById('stat-unique').textContent = notRepeated.length;
  document.getElementById('status-dot').classList.add('active');

  resultsEl.innerHTML = '';
  renderCodesCard(resultsEl, '🔁 Repeated maps', repeated, 'No repeated maps found.');
  renderCodesCard(resultsEl, '✅ Not repeated maps', notRepeated, 'No unique maps found.');

  statusEl.textContent =
    `${codesA.size} + ${codesB.size} map(s) read · ${repeated.length} repeated · ${notRepeated.length} not repeated.`;
});
