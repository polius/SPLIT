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

function displayResults(transactions) {
  const t = translations[currentLanguage];
  const summary = document.getElementById('summary');
  summary.innerHTML = `<h4>${t.summaryTitle}</h4>`;
  
  let hasDebts = false;
  
  for (const [debtor, creditors] of Object.entries(transactions)) {
    const payments = Object.entries(creditors).filter(([_, amount]) => amount > 0);
    
    if (payments.length > 0) {
      hasDebts = true;
      
      const card = document.createElement('div');
      card.className = 'person-card';
      
      const nameDiv = document.createElement('div');
      nameDiv.className = 'person-name';
      nameDiv.innerHTML = `<span class="name-highlight">${debtor}</span> ${t.needsToPay}`;
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
    const t = translations[currentLanguage];
    const noDebts = document.createElement('div');
    noDebts.className = 'no-debts';
    noDebts.textContent = t.balancedMessage;
    summary.appendChild(noDebts);
  }
  
  summary.classList.remove('hidden');
}

function calculate() {
  const people = getPeopleData();
  
  if (people.length < 2) {
    return;
  }
  
  const transactions = calculateDebts(people);
  displayResults(transactions);
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
