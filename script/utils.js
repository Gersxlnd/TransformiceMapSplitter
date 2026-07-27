function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function copyText(text, btn) {
  const original = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    try { document.execCommand('copy'); } catch (err) {}
    document.body.removeChild(helper);
  }
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = original; }, 1200);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function setupExpandable(row) {
  const block = row.querySelector('.codes-block');
  const expandBtn = row.querySelector('.expand-btn');
  const fade = row.querySelector('.codes-fade');
  if (!block || !expandBtn) return;

  function refresh() {
    // Only meaningful while collapsed — once expanded there's no max-height
    // to overflow, so skip the check or the button would hide itself.
    if (row.classList.contains('is-expanded')) return;
    const isOverflowing = block.scrollHeight > block.clientHeight + 2;
    expandBtn.hidden = !isOverflowing;
    if (fade) fade.hidden = !isOverflowing;
  }

  requestAnimationFrame(refresh);
  setTimeout(refresh, 50);

  expandBtn.addEventListener('click', () => {
    const expanded = row.classList.toggle('is-expanded');
    expandBtn.textContent = expanded ? 'Minimize' : 'Expand';
    if (!expanded) refresh();
  });
}

function buildCodesBlock(codes, emptyMessage, options) {
  const showCopy = !options || options.showCopy !== false;

  const block = document.createElement('div');
  block.className = 'codes-block';

  const line = document.createElement('div');
  line.className = 'codes-line';
  const codesText = document.createElement('span');
  codesText.className = 'codes-text';
  codesText.textContent = codes.length ? codes.join(', ') : (emptyMessage || '');
  line.appendChild(codesText);

  if (showCopy) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.disabled = codes.length === 0;
    if (codes.length) {
      copyBtn.addEventListener('click', () => copyText(codes.join(', '), copyBtn));
    }
    line.appendChild(copyBtn);
  }
  block.appendChild(line);

  const fade = document.createElement('div');
  fade.className = 'codes-fade';
  block.appendChild(fade);

  // expand button lives outside the clipped block, below it, so it never
  // overlaps the last line of text once expanded
  const fragment = document.createDocumentFragment();
  fragment.appendChild(block);

  const expandBtn = document.createElement('button');
  expandBtn.type = 'button';
  expandBtn.className = 'expand-btn';
  expandBtn.hidden = true;
  expandBtn.textContent = 'Expand';
  fragment.appendChild(expandBtn);

  return fragment;
}

function appendCategoryRows(container, categories) {
  for (const [category, codes] of categories) {
    const row = document.createElement('div');
    row.className = 'category-row';

    const head = document.createElement('div');
    head.className = 'category-head';
    head.innerHTML = `
      <span class="left">
        <span class="pill">${escapeHtml(category)}</span>
        <span class="count-tag">${codes.length} map(s)</span>
      </span>
    `;

    row.appendChild(head);
    row.appendChild(buildCodesBlock(codes));
    container.appendChild(row);
    setupExpandable(row);
  }
}
