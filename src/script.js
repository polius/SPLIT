let personCount = 2;

// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const themeIcon = document.querySelector('.theme-icon');
  if (themeIcon) {
    themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
}

function detectBrowserLanguage() {
  const browserLang = (navigator.language || navigator.userLanguage).split('-')[0];
  const supportedLanguages = ['ca', 'es', 'en'];
  return supportedLanguages.includes(browserLang) ? browserLang : 'ca';
}

let currentLanguage = localStorage.getItem('language') || detectBrowserLanguage();
let translations = {};
let appConfig = window.APP_CONFIG || { currency: '€', currencyPosition: 'right' };

function formatCurrency(amount) {
  const formatted = amount.toFixed(2);
  return appConfig.currencyPosition === 'left' 
    ? `${appConfig.currency}${formatted}`
    : `${formatted}${appConfig.currency}`;
}

async function loadTranslations() {
  const response = await fetch('translations.json');
  translations = await response.json();
  updateUILanguage();
}

function updateUILanguage() {
  const t = translations[currentLanguage];
  
  document.title = `SPLIT: ${t.title}`;
  document.querySelector('h1').textContent = t.title;
  document.getElementById('add').textContent = t.addPersonButton;
  document.getElementById('submit').textContent = t.calculateButton;
  
  document.querySelectorAll('input[type="text"]').forEach(input => {
    input.placeholder = t.namePlaceholder;
  });
  
  document.querySelectorAll('input[type="number"]').forEach(input => {
    input.placeholder = t.amountPlaceholder;
  });
}

function changeLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem('language', lang);
  updateUILanguage();
  
  const summary = document.getElementById('summary');
  if (!summary.classList.contains('hidden')) {
    calculate();
  }
}

function addPerson() {
  personCount++;
  const content = document.getElementById('content');
  const personDiv = createPersonInput(personCount);
  content.appendChild(personDiv);
  document.getElementById(`name${personCount}`).focus();
  updateRemoveButtonsVisibility();
}

function createPersonInput(index) {
  const t = translations[currentLanguage];
  const div = document.createElement('div');
  div.className = 'person-input';
  div.dataset.index = index;
  div.innerHTML = `
    <input id="name${index}" type="text" placeholder="${t.namePlaceholder}" required>
    <input id="value${index}" type="number" placeholder="${t.amountPlaceholder}" step="0.01" required>
    <button type="button" class="remove-btn" onclick="removePerson(${index})">-</button>
  `;
  return div;
}

function updateRemoveButtonsVisibility() {
  const inputs = document.querySelectorAll('.person-input');
  const removeButtons = document.querySelectorAll('.remove-btn');
  
  if (inputs.length <= 2) {
    removeButtons.forEach(btn => btn.classList.add('hidden'));
  } else {
    removeButtons.forEach(btn => btn.classList.remove('hidden'));
  }
}

function removePerson(index) {
  const inputs = document.querySelectorAll('.person-input');
  
  if (inputs.length <= 2) {
    return;
  }
  
  const personDiv = document.querySelector(`.person-input[data-index="${index}"]`);
  if (personDiv) {
    personDiv.remove();
    updateRemoveButtonsVisibility();
    
    const summary = document.getElementById('summary');
    if (!summary.classList.contains('hidden')) {
      calculate();
    }
  }
}

function getPeopleData() {
  const people = [];
  const inputs = document.querySelectorAll('.person-input');
  
  inputs.forEach(input => {
    const index = input.dataset.index;
    const nameInput = document.getElementById(`name${index}`);
    const valueInput = document.getElementById(`value${index}`);
    
    if (nameInput && valueInput) {
      const name = nameInput.value.trim();
      const value = parseFloat(valueInput.value) || 0;
      if (name) people.push({ name, value });
    }
  });
  
  return people;
}

function calculateDebts(people) {
  if (people.length === 0) return {};
  
  const total = people.reduce((sum, p) => sum + p.value, 0);
  const average = total / people.length;
  
  const balances = people.map(p => ({
    name: p.name,
    balance: p.value - average
  }));
  
  const creditors = balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance);
  const debtors = balances.filter(b => b.balance < 0).map(b => ({ ...b, balance: -b.balance })).sort((a, b) => b.balance - a.balance);
  
  const transactions = {};
  people.forEach(p => {
    transactions[p.name] = {};
    people.forEach(p2 => transactions[p.name][p2.name] = 0);
  });
  
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].balance, creditors[j].balance);
    transactions[debtors[i].name][creditors[j].name] = parseFloat(amount.toFixed(2));
    
    debtors[i].balance -= amount;
    creditors[j].balance -= amount;
    
    if (debtors[i].balance < 0.01) i++;
    if (creditors[j].balance < 0.01) j++;
  }
  
  return transactions;
}

function buildSummaryText(transactions) {
  const t = translations[currentLanguage];
  const people = getPeopleData();
  const total = people.reduce((sum, p) => sum + p.value, 0);
  const avg = total / people.length;
  let text = `${t.summaryTitle}\n`;
  text += `${t.totalSpent}: ${formatCurrency(total)} | ${t.perPerson}: ${formatCurrency(avg)}\n\n`;
  
  let hasDebts = false;
  for (const [debtor, creditors] of Object.entries(transactions)) {
    const payments = Object.entries(creditors).filter(([_, amount]) => amount > 0);
    if (payments.length > 0) {
      hasDebts = true;
      text += `${debtor} ${t.needsToPay}\n`;
      payments.forEach(([creditor, amount]) => {
        text += `  → ${creditor}: ${formatCurrency(amount)}\n`;
      });
      text += '\n';
    }
  }
  if (!hasDebts) text += t.balancedMessage;
  return text.trim();
}

function copySummary(transactions) {
  const t = translations[currentLanguage];
  const text = buildSummaryText(transactions);
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-summary-btn');
    if (btn) {
      btn.classList.add('copied');
      const originalText = btn.innerHTML;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>${t.copied}`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = originalText;
      }, 2000);
    }
  });
}

function shareSummary(transactions) {
  const t = translations[currentLanguage];
  const text = buildSummaryText(transactions);
  
  if (navigator.share) {
    navigator.share({
      title: 'SPLIT',
      text: text
    }).catch(() => {});
  } else {
    // Fallback: copy to clipboard
    copySummary(transactions);
  }
}

function validateInputs() {
  const inputs = document.querySelectorAll('.person-input');
  let valid = true;
  let filledCount = 0;
  
  // Clear previous invalid state
  document.querySelectorAll('.person-input input').forEach(input => {
    input.classList.remove('invalid');
  });
  
  inputs.forEach(input => {
    const index = input.dataset.index;
    const nameInput = document.getElementById(`name${index}`);
    const valueInput = document.getElementById(`value${index}`);
    
    if (nameInput && valueInput) {
      const hasName = nameInput.value.trim() !== '';
      const hasValue = valueInput.value !== '';
      
      // If at least one field is filled, both are required
      if (hasName || hasValue) {
        filledCount++;
        if (!hasName) {
          nameInput.classList.add('invalid');
          valid = false;
        }
        if (!hasValue) {
          valueInput.classList.add('invalid');
          valid = false;
        }
      }
    }
  });
  
  // Need at least 2 people
  if (filledCount < 2) {
    inputs.forEach(input => {
      const index = input.dataset.index;
      const nameInput = document.getElementById(`name${index}`);
      const valueInput = document.getElementById(`value${index}`);
      if (nameInput && !nameInput.value.trim()) nameInput.classList.add('invalid');
      if (valueInput && !valueInput.value) valueInput.classList.add('invalid');
    });
    valid = false;
  }
  
  // Auto-clear invalid state when user starts typing
  document.querySelectorAll('.person-input input.invalid').forEach(input => {
    const handler = () => {
      input.classList.remove('invalid');
      input.removeEventListener('input', handler);
    };
    input.addEventListener('input', handler);
  });
  
  return valid;
}

function buildContributionBreakdown(people, average) {
  const t = translations[currentLanguage];
  const maxDiff = Math.max(...people.map(p => Math.abs(p.value - average)), 1);
  
  let html = `<div class="contributions-section">`;
  html += `<div class="contributions-title">${t.contributions}</div>`;
  
  people.forEach(p => {
    const diff = p.value - average;
    const absDiff = Math.abs(diff);
    const barWidth = Math.max((absDiff / maxDiff) * 100, 3);
    
    let barClass, diffClass, label;
    if (diff > 0.01) {
      barClass = 'overpaid';
      diffClass = 'positive';
      label = `+${formatCurrency(absDiff)}`;
    } else if (diff < -0.01) {
      barClass = 'underpaid';
      diffClass = 'negative';
      label = `-${formatCurrency(absDiff)}`;
    } else {
      barClass = 'even';
      diffClass = 'neutral';
      label = t.onTrack;
    }
    
    html += `
      <div class="contribution-item">
        <span class="contribution-name">${p.name}</span>
        <div class="contribution-bar-wrapper">
          <div class="contribution-bar ${barClass}" style="width: ${barWidth}%"></div>
        </div>
        <span class="contribution-diff ${diffClass}">${label}</span>
      </div>`;
  });
  
  html += `</div>`;
  return html;
}

function displayResults(transactions) {
  const t = translations[currentLanguage];
  const summary = document.getElementById('summary');
  const people = getPeopleData();
  const total = people.reduce((sum, p) => sum + p.value, 0);
  const average = total / people.length;
  
  // Count transactions
  let transactionCount = 0;
  for (const [debtor, creditors] of Object.entries(transactions)) {
    transactionCount += Object.entries(creditors).filter(([_, amount]) => amount > 0).length;
  }
  
  // Build summary header with title + action buttons
  summary.innerHTML = `
    <div class="summary-header">
      <h4>${t.summaryTitle}</h4>
      <div class="summary-actions">
        <button class="copy-summary-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg>
          ${t.copySummary}
        </button>
        <button class="share-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          ${t.shareSummary}
        </button>
      </div>
    </div>
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-value">${formatCurrency(total)}</span>
        <span class="stat-label">${t.totalSpent}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${formatCurrency(average)}</span>
        <span class="stat-label">${t.perPerson}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${transactionCount}</span>
        <span class="stat-label">${t.transactions}</span>
      </div>
    </div>
    ${buildContributionBreakdown(people, average)}
    <div class="summary-divider"></div>
  `;
  
  // Wire up action buttons
  summary.querySelector('.copy-summary-btn').addEventListener('click', () => copySummary(transactions));
  summary.querySelector('.share-btn').addEventListener('click', () => shareSummary(transactions));
  
  let hasDebts = false;
  
  for (const [debtor, creditors] of Object.entries(transactions)) {
    const payments = Object.entries(creditors).filter(([_, amount]) => amount > 0);
    
    if (payments.length > 0) {
      hasDebts = true;
      
      const card = document.createElement('div');
      card.className = 'person-card';
      
      const nameDiv = document.createElement('div');
      nameDiv.className = 'person-name';
      nameDiv.innerHTML = `<span class="name-highlight">${debtor}</span> <span class="pays-label">${t.needsToPay}</span>`;
      card.appendChild(nameDiv);
      
      const ul = document.createElement('ul');
      ul.className = 'debt-list';
      
      payments.forEach(([creditor, amount]) => {
        const li = document.createElement('li');
        li.className = 'debt-item';
        
        const recipient = document.createElement('span');
        recipient.className = 'debt-recipient';
        recipient.textContent = creditor;
        
        const amountSpan = document.createElement('span');
        amountSpan.className = 'debt-amount';
        amountSpan.textContent = formatCurrency(amount);
        
        li.appendChild(recipient);
        li.appendChild(amountSpan);
        ul.appendChild(li);
      });
      
      card.appendChild(ul);
      summary.appendChild(card);
    }
  }
  
  if (!hasDebts) {
    const noDebts = document.createElement('div');
    noDebts.className = 'no-debts';
    noDebts.textContent = t.balancedMessage;
    summary.appendChild(noDebts);
  }
  
  summary.classList.remove('hidden');
}

function calculate() {
  if (!validateInputs()) {
    return;
  }
  
  const people = getPeopleData();
  
  if (people.length < 2) {
    return;
  }
  
  const transactions = calculateDebts(people);
  displayResults(transactions);
  
  // Smooth scroll to results
  setTimeout(() => {
    document.getElementById('summary').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadTranslations();
  
  // Initialize theme
  initTheme();
  
  document.getElementById('add').addEventListener('click', addPerson);
  document.getElementById('submit').addEventListener('click', calculate);
  
  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      changeLanguage(btn.dataset.lang);
    });
    
    if (btn.dataset.lang === currentLanguage) {
      btn.classList.add('active');
    }
  });
  
  document.getElementById('content').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      calculate();
    }
  });
});
