const defaultSpeeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const speedList = document.getElementById('speedList');
const newSpeedInput = document.getElementById('newSpeed');
const addBtn = document.getElementById('addBtn');

function loadSpeeds() {
  chrome.storage.local.get({ customSpeeds: defaultSpeeds }, (data) => {
    const sortedSpeeds = data.customSpeeds.sort((a, b) => a - b);
    speedList.innerHTML = '';
    sortedSpeeds.forEach(speed => {
      const tag = document.createElement('div');
      const valSpan = document.createElement('span');

      tag.className = 'speed-tag';
      valSpan.textContent = `${speed}x`;
      tag.appendChild(valSpan);
      
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => removeSpeed(speed));
      
      tag.appendChild(removeBtn);
      speedList.appendChild(tag);
    });
  });
}

function addSpeed() {
  const val = parseFloat(newSpeedInput.value);
  if (!val || val <= 0 || val > 16) return;
  
  chrome.storage.local.get({ customSpeeds: defaultSpeeds }, (data) => {
    let current = data.customSpeeds;
    if (!current.includes(val)) {
      current.push(val);
      chrome.storage.local.set({ customSpeeds: current }, () => {
        loadSpeeds();
        newSpeedInput.value = '';
      });
    }
  });
}

function removeSpeed(speed) {
  chrome.storage.local.get({ customSpeeds: defaultSpeeds }, (data) => {
    const filtered = data.customSpeeds.filter(s => s !== speed);
    chrome.storage.local.set({ customSpeeds: filtered }, loadSpeeds);
  });
}

addBtn.addEventListener('click', addSpeed);
newSpeedInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addSpeed();
});

document.addEventListener('DOMContentLoaded', loadSpeeds);