function parseList(raw) {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const players = new Map();
  let ignored = 0;

  for (const line of lines) {
    const parts = line.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 5) { ignored++; continue; }

    const category = parts[parts.length - 1];
    const codeRaw = parts[parts.length - 4];
    const name = parts.slice(0, parts.length - 4).join(' - ');

    if (!/^@?\d+$/.test(codeRaw)) { ignored++; continue; }
    const code = codeRaw.replace(/^@/, '');

    if (!players.has(name)) players.set(name, new Map());
    const categories = players.get(name);
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(code);
  }

  return { players, ignored, totalLines: lines.length };
}

function buildPlayerCopyText(name, categories) {
  let text = `${name} maps:\n`;
  for (const [category, codes] of categories) {
    text += `${category}: ${codes.join(', ')}\n`;
  }
  return text.trim();
}

function buildCategoryCopyText(categories) {
  let text = '';
  for (const [category, codes] of categories) {
    text += `${category}: ${codes.join(', ')}\n`;
  }
  return text.trim();
}

function mergeByCategory(players) {
  const merged = new Map();
  for (const categories of players.values()) {
    for (const [category, codes] of categories) {
      if (!merged.has(category)) merged.set(category, []);
      merged.get(category).push(...codes);
    }
  }
  return merged;
}

function setHero(players, ignored, categorySet) {
  const dot = document.getElementById('status-dot');
  const hasData = players.size > 0;
  dot.classList.toggle('active', hasData);
  document.getElementById('hero-players').textContent = hasData ? players.size : '—';
  document.getElementById('hero-categories').textContent = hasData ? categorySet.size : '—';
  document.getElementById('hero-ignored').textContent = hasData || ignored > 0 ? ignored : '—';
  let totalMaps = 0;
  for (const cats of players.values()) for (const arr of cats.values()) totalMaps += arr.length;
  document.getElementById('hero-maps').textContent = hasData ? totalMaps : '—';
  return totalMaps;
}

let groupMode = 'player';

function render(raw) {
  const resultsEl = document.getElementById('results');
  const statusEl = document.getElementById('status-text');
  const tilesSection = document.getElementById('tiles-section');
  const resultsHeading = document.getElementById('results-heading');
  resultsHeading.textContent = groupMode === 'category' ? 'Results by category' : 'Results by player';
  resultsEl.innerHTML = '';

  const emptyHint = groupMode === 'category'
    ? 'Categories merged across all players will appear here.'
    : 'Grouped results by player and category will appear here.';

  if (!raw.trim()) {
    resultsEl.innerHTML = `<p class="empty-hint">${emptyHint}</p>`;
    statusEl.textContent = 'Waiting for list…';
    tilesSection.style.display = 'none';
    setHero(new Map(), 0, new Set());
    return;
  }

  const { players, ignored, totalLines } = parseList(raw);
  const categorySet = new Set();
  for (const cats of players.values()) for (const cat of cats.keys()) categorySet.add(cat);

  if (players.size === 0) {
    resultsEl.innerHTML = '<p class="empty-hint">No lines recognized. Check the format: Player - @code - number - percent - category.</p>';
    statusEl.textContent = `0 of ${totalLines} line(s) recognized.`;
    tilesSection.style.display = 'none';
    setHero(new Map(), ignored, new Set());
    return;
  }

  const totalMaps = setHero(players, ignored, categorySet);
  tilesSection.style.display = 'flex';
  document.getElementById('tile-players').textContent = players.size;
  document.getElementById('tile-maps').textContent = totalMaps;
  document.getElementById('tile-categories').textContent = categorySet.size;
  document.getElementById('tile-ignored').textContent = ignored;

  if (groupMode === 'category') {
    const merged = mergeByCategory(players);
    const card = document.createElement('div');
    card.className = 'player-card';

    const header = document.createElement('div');
    header.className = 'player-header';
    header.innerHTML = `
      <span class="player-name">🧀 All players</span>
      <span class="player-meta">${totalMaps} map(s) · ${merged.size} categor${merged.size === 1 ? 'y' : 'ies'}</span>
    `;
    const copyAllBtn = document.createElement('button');
    copyAllBtn.className = 'copy-all-btn';
    copyAllBtn.textContent = 'Copy all';
    copyAllBtn.addEventListener('click', () => copyText(buildCategoryCopyText(merged), copyAllBtn));
    header.appendChild(copyAllBtn);
    card.appendChild(header);

    appendCategoryRows(card, merged);
    resultsEl.appendChild(card);
  } else {
    for (const [name, categories] of players) {
      const playerCard = document.createElement('div');
      playerCard.className = 'player-card';

      const mapCount = [...categories.values()].reduce((sum, arr) => sum + arr.length, 0);

      const header = document.createElement('div');
      header.className = 'player-header';
      header.innerHTML = `
        <span class="player-name">🐭 ${escapeHtml(name)}</span>
        <span class="player-meta">${mapCount} map(s) · ${categories.size} categor${categories.size === 1 ? 'y' : 'ies'}</span>
      `;
      const copyAllBtn = document.createElement('button');
      copyAllBtn.className = 'copy-all-btn';
      copyAllBtn.textContent = 'Copy all';
      copyAllBtn.addEventListener('click', () => copyText(buildPlayerCopyText(name, categories), copyAllBtn));
      header.appendChild(copyAllBtn);
      playerCard.appendChild(header);

      appendCategoryRows(playerCard, categories);
      resultsEl.appendChild(playerCard);
    }
  }

  const ignoredNote = ignored > 0 ? ` · ${ignored} line(s) skipped` : '';
  statusEl.textContent = `${players.size} player(s), ${totalMaps} map(s) total${ignoredNote}.`;
}

document.getElementById('split-btn').addEventListener('click', () => {
  render(document.getElementById('input-list').value);
});

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('active')) return;
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-checked', 'true');
    groupMode = btn.dataset.mode;
    render(document.getElementById('input-list').value);
  });
});
