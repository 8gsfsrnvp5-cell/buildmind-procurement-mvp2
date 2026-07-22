const STORAGE_KEY = 'buildmind-procurement-data-v1';

const defaultMaterials = [
  {
    name: 'Труба 76', responsible: 'Снабженец', unit: 'м', need: 5800, stock: 0, reserved: 3000,
    confirmed: 3000, deliveryDate: '2026-07-10', leadDays: 1
  },
  {
    name: 'Уголок', responsible: 'Прораб', unit: 'шт', need: 2000, stock: 0, reserved: 1500,
    confirmed: 1500, deliveryDate: '2026-07-11', leadDays: 2
  },
  {
    name: 'Хомуты', responsible: 'Кладовщик', unit: 'шт', need: 4500, stock: 0, reserved: 2500,
    confirmed: 2500, deliveryDate: '2026-07-10', leadDays: 1
  }
];

let materials = loadMaterials();

function loadMaterials() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return [...defaultMaterials];
  }

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn('Не удалось прочитать сохранённые данные BuildMind:', error);
  }

  return [...defaultMaterials];
}

function saveMaterials() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
}

function parseDate(value) {
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  if (!date) return '—';
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function riskFor(row, needDate, today) {
  const free = Math.max(row.stock - row.reserved, 0);
  const available = free + row.confirmed;
  const deficit = Math.max(row.need - available, 0);
  const orderDeadline = addDays(needDate, -row.leadDays);
  const delivery = parseDate(row.deliveryDate);

  if (deficit > 0) {
    return {
      level: 'critical',
      text: 'Критический',
      action: `Оформить дополнительную заявку на ${deficit} ${row.unit}. Крайняя дата заказа: ${formatDate(orderDeadline)}.`
    };
  }

  if (delivery && delivery > needDate) {
    return {
      level: 'critical',
      text: 'Критический',
      action: 'Поставка позже даты потребности. Ускорить поставку или найти резервного поставщика.'
    };
  }

  if (today > orderDeadline && row.confirmed === 0) {
    return {
      level: 'warning',
      text: 'Предупреждение',
      action: 'Крайняя дата заказа уже прошла. Проверьте наличие резерва или альтернативного поставщика.'
    };
  }

  return {
    level: 'ok',
    text: 'ОК',
    action: 'Материал обеспечен при условии подтверждения статуса поставки.'
  };
}

function render() {
  const tbody = document.querySelector('#materialsTable tbody');
  tbody.innerHTML = '';

  const startDate = parseDate(document.getElementById('workStartDate').value);
  const safetyDays = Number(document.getElementById('safetyDays').value || 0);
  const today = parseDate(document.getElementById('todayDate').value) || new Date();
  const needDate = addDays(startDate, -safetyDays);

  let critical = 0;
  let warning = 0;
  let ok = 0;

  materials.forEach((row, index) => {
    const free = Math.max(row.stock - row.reserved, 0);
    const available = free + row.confirmed;
    const deficit = Math.max(row.need - available, 0);
    const orderDeadline = addDays(needDate, -row.leadDays);
    const risk = riskFor(row, needDate, today);

    if (risk.level === 'critical') critical++;
    if (risk.level === 'warning') warning++;
    if (risk.level === 'ok') ok++;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.name}</td>
      <td>${row.responsible || '—'}</td>
      <td>${row.need}</td>
      <td>${row.unit}</td>
      <td>${row.stock}</td>
      <td>${row.reserved}</td>
      <td>${free}</td>
      <td>${row.confirmed}</td>
      <td>${row.deliveryDate || '—'}</td>
      <td>${row.leadDays}</td>
      <td>${deficit}</td>
      <td>${formatDate(needDate)}</td>
      <td>${formatDate(orderDeadline)}</td>
      <td><span class="badge ${risk.level}">${risk.text}</span></td>
      <td>${risk.action}</td>
      <td><button class="small-btn" onclick="deleteMaterial(${index})">Удалить</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('criticalCount').textContent = critical;
  document.getElementById('warningCount').textContent = warning;
  document.getElementById('okCount').textContent = ok;
}

function addMaterial() {
  const name = document.getElementById('newName').value.trim();
  const responsible = document.getElementById('newResponsible').value.trim() || 'Не назначен';
  const need = Number(document.getElementById('newNeed').value);
  const unit = document.getElementById('newUnit').value.trim() || 'шт';

  if (!name || !need) {
    alert('Введите материал и нужное количество.');
    return;
  }

  materials.push({
    name,
    responsible,
    unit,
    need,
    stock: Number(document.getElementById('newStock').value || 0),
    reserved: Number(document.getElementById('newReserved').value || 0),
    confirmed: Number(document.getElementById('newConfirmed').value || 0),
    deliveryDate: document.getElementById('newDelivery').value,
    leadDays: Number(document.getElementById('newLead').value || 1)
  });

  saveMaterials();
  clearAddForm();
  render();
}

function deleteMaterial(index) {
  materials.splice(index, 1);
  saveMaterials();
  render();
}

function clearAddForm() {
  document.getElementById('newName').value = '';
  document.getElementById('newResponsible').value = '';
  document.getElementById('newNeed').value = '';
  document.getElementById('newUnit').value = '';
  document.getElementById('newStock').value = '0';
  document.getElementById('newReserved').value = '0';
  document.getElementById('newConfirmed').value = '0';
  document.getElementById('newDelivery').value = '';
  document.getElementById('newLead').value = '1';
}

function resetMaterials() {
  const confirmed = confirm('Сбросить материалы к стартовому примеру? Все добавленные материалы будут удалены.');
  if (!confirmed) return;

  materials = [...defaultMaterials];
  saveMaterials();
  render();
}

function exportJson() {
  const data = {
    project: document.getElementById('projectName').value,
    object: document.getElementById('objectName').value,
    work: document.getElementById('workName').value,
    workStartDate: document.getElementById('workStartDate').value,
    safetyDays: Number(document.getElementById('safetyDays').value || 0),
    materials
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'buildmind-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('recalcBtn').addEventListener('click', render);
document.getElementById('addBtn').addEventListener('click', addMaterial);
document.getElementById('exportBtn').addEventListener('click', exportJson);
document.getElementById('resetBtn').addEventListener('click', resetMaterials);
render();
function calculateAssistantRow(material) {
  const need = Number(material.need) || 0;
  const stock = Number(material.stock) || 0;
  const reserved = Number(material.reserved) || 0;
  const confirmed = Number(material.confirmed) || 0;

  const free = Math.max(0, stock - reserved);
  const available = free + confirmed;
  const deficit = Math.max(0, need - available);

  return {
    ...material,
    need,
    stock,
    reserved,
    confirmed,
    free,
    available,
    deficit
  };
}

function runBuildMindAssistant() {
  const input = document.getElementById('assistantInput');
  const answer = document.getElementById('assistantAnswer');

  if (!input || !answer) {
    return;
  }

  const command = input.value.trim().toLowerCase();

  if (!command) {
    answer.textContent = 'Введите команду для BuildMind.';
    return;
  }

  const calculatedMaterials = materials.map(calculateAssistantRow);

  if (
    command.includes('дефицит') ||
    command.includes('не хватает') ||
    command.includes('риск')
  ) {
    const deficitMaterials = calculatedMaterials.filter(item => item.deficit > 0);

    if (deficitMaterials.length === 0) {
      answer.textContent = 'Материалов с дефицитом не найдено.';
      return;
    }

    const lines = deficitMaterials.map(item => {
      return `- ${item.name}: дефицит ${item.deficit} ${item.unit}, ответственный: ${item.responsible || 'не назначен'}`;
    });

    answer.textContent =
      'Материалы с дефицитом:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes('все материалы') ||
    command.includes('покажи материалы') ||
    command.includes('список материалов')
  ) {
    const lines = calculatedMaterials.map(item => {
      return `- ${item.name}: нужно ${item.need} ${item.unit}, доступно ${item.available} ${item.unit}, дефицит ${item.deficit} ${item.unit}`;
    });

    answer.textContent =
      'Список материалов:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes('ответственный') ||
    command.includes('кто отвечает') ||
    command.includes('ответственные')
  ) {
    const lines = calculatedMaterials.map(item => {
      return `- ${item.name}: ${item.responsible || 'ответственный не назначен'}`;
    });

    answer.textContent =
      'Ответственные по материалам:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes('помощь') ||
    command.includes('что умеешь') ||
    command.includes('команды')
  ) {
    answer.textContent =
      'Я пока понимаю простые команды:\n\n' +
      '1. Покажи материалы с дефицитом\n' +
      '2. Покажи все материалы\n' +
      '3. Кто ответственный\n' +
      '4. Помощь\n\n' +
      'Позже я буду понимать проекты, объекты, работы и периоды.';
    return;
  }

  answer.textContent =
    'Я пока не понял команду.\n\n' +
    'Попробуйте написать:\n' +
    '- Покажи материалы с дефицитом\n' +
    '- Покажи все материалы\n' +
    '- Кто ответственный\n' +
    '- Помощь';
}

const askAssistantBtn = document.getElementById('askAssistantBtn');
const clearAssistantBtn = document.getElementById('clearAssistantBtn');
const assistantInput = document.getElementById('assistantInput');

if (askAssistantBtn) {
  askAssistantBtn.addEventListener('click', runBuildMindAssistant);
}

if (clearAssistantBtn) {
  clearAssistantBtn.addEventListener('click', function () {
    const answer = document.getElementById('assistantAnswer');
    const input = document.getElementById('assistantInput');

    if (answer) {
      answer.textContent = 'Здесь появится ответ BuildMind.';
    }

    if (input) {
      input.value = '';
    }
  });
}

if (assistantInput) {
  assistantInput.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.key === 'Enter') {
      runBuildMindAssistant();
    }
  });
}
