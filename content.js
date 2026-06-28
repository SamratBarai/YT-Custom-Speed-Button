(() => {
  const defaultSpeeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
  const SLIDER_MIN = 0.1;
  const SLIDER_MAX = 4;
  const SLIDER_STEP = 0.05;
  let activeSpeeds = [...defaultSpeeds];
  let uiCheckInterval = null;
  let keyboardHandler = null;

  // Sync with Extension Storage
  function updateSpeedConfiguration() {
    chrome.storage.local.get({ customSpeeds: defaultSpeeds }, (data) => {
      activeSpeeds = data.customSpeeds.sort((a, b) => a - b);
      injectSpeedController();
      renderGridItems();
    });
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.customSpeeds) {
      activeSpeeds = changes.customSpeeds.newValue.sort((a, b) => a - b);
      renderGridItems();
    }
  });

  // Returns the index in activeSpeeds closest to the given rate
  function findNearestSpeedIndex(rate) {
    let closestIdx = 0;
    let closestDiff = Infinity;
    activeSpeeds.forEach((speed, i) => {
      const diff = Math.abs(speed - rate);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = i;
      }
    });
    return closestIdx;
  }

  // Keyboard Shortcut Handler — intercepts Shift+, and Shift+. before YouTube does
  function setupKeyboardShortcuts() {
    if (keyboardHandler) {
      document.removeEventListener('keydown', keyboardHandler, true);
    }

    keyboardHandler = (e) => {
      if (!location.pathname.startsWith('/watch')) return;
      if (!e.shiftKey) return;

      // Don't fire when the user is typing somewhere
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

      const isDecrease = e.code === 'Comma';   // Shift+,  →  <
      const isIncrease = e.code === 'Period';  // Shift+.  →  >
      if (!isDecrease && !isIncrease) return;

      const player = document.querySelector('ytd-watch-flexy #movie_player') || document.querySelector('.html5-video-player');
      if (!player) return;
      const video = player.querySelector('video');
      if (!video || activeSpeeds.length === 0) return;

      // Block YouTube's own Shift+,/. handler
      e.stopImmediatePropagation();
      e.preventDefault();

      const currentIdx = findNearestSpeedIndex(video.playbackRate);
      const newRate = isDecrease
        ? activeSpeeds[Math.max(0, currentIdx - 1)]
        : activeSpeeds[Math.min(activeSpeeds.length - 1, currentIdx + 1)];
      video.playbackRate = newRate;
      showSpeedOSD(player, newRate, isDecrease);
    };

    // capture: true ensures we run before YouTube's own listeners
    document.addEventListener('keydown', keyboardHandler, true);
  }

  // Brief on-screen speed indicator — mirrors YouTube's native bezel that we suppress
  function showSpeedOSD(player, rate, isDecrease) {
    let osd = player.querySelector('#ytp-custom-speed-osd');
    if (!osd) {
      osd = document.createElement('div');
      osd.id = 'ytp-custom-speed-osd';
      player.appendChild(osd);
    }

    // Arrow direction + speed value, e.g. "◀◀  0.75×" or "▶▶  1.5×"
    const arrows = isDecrease ? '◀◀' : '▶▶';
    const label = document.createTextNode(`${formatSpeed(rate)}×`);
    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'ytp-osd-arrows';
    arrowSpan.textContent = arrows;

    while (osd.firstChild) osd.removeChild(osd.firstChild);
    osd.appendChild(arrowSpan);
    osd.appendChild(label);

    // Restart animation cleanly
    osd.classList.remove('ytp-custom-speed-osd');
    void osd.offsetWidth; // force reflow
    osd.classList.add('ytp-custom-speed-osd');
  }

  // Structural Injection System
  function injectSpeedController() {
    // Target the main watch player specifically to avoid ghost players
    const player = document.querySelector('ytd-watch-flexy #movie_player') || document.querySelector('.html5-video-player');
    if (!player) return;

    const controls = player.querySelector('.ytp-right-controls');
    const video = player.querySelector('video');

    if (!controls || !video || player.querySelector('#ytp-custom-speed-ctrl')) return;

    // 1. Create Control Ribbon Button with Native SVG Icon + Text securely without innerHTML
    const controlButton = document.createElement('button');
    controlButton.id = 'ytp-custom-speed-ctrl';
    controlButton.className = 'ytp-button ytp-custom-speed-btn';

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("fill", "none");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.style.width = "22px";
    svg.style.height = "22px";
    svg.style.flexShrink = "0";

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", "M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zM10.59 15.41a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z");
    svg.appendChild(path);

    const valSpan = document.createElement('span');
    valSpan.id = 'ytp-custom-speed-val';
    valSpan.textContent = `${formatSpeed(video.playbackRate)}x`;

    controlButton.appendChild(svg);
    controlButton.appendChild(valSpan);

    // 2. Create Grid Popover Element safely without innerHTML
    const menuPanel = document.createElement('div');
    menuPanel.id = 'ytp-custom-speed-panel';
    menuPanel.className = 'ytp-custom-speed-menu';

    const menuTitle = document.createElement('div');
    menuTitle.className = 'ytp-custom-menu-title';
    menuTitle.textContent = 'Custom Speeds';

    const gridTarget = document.createElement('div');
    gridTarget.className = 'ytp-custom-grid';
    gridTarget.id = 'ytp-speed-grid-target';

    const sliderRow = document.createElement('div');
    sliderRow.className = 'ytp-custom-slider-row';

    const sliderInput = document.createElement('input');
    sliderInput.type = 'range';
    sliderInput.id = 'ytp-custom-speed-slider';
    sliderInput.className = 'ytp-custom-speed-slider';
    sliderInput.min = SLIDER_MIN.toString();
    sliderInput.max = SLIDER_MAX.toString();
    sliderInput.step = SLIDER_STEP.toString();
    sliderInput.value = Math.min(Math.max(video.playbackRate, SLIDER_MIN), SLIDER_MAX).toString();

    const sliderValSpan = document.createElement('span');
    sliderValSpan.className = 'ytp-custom-slider-val';
    sliderValSpan.id = 'ytp-custom-slider-val';
    sliderValSpan.textContent = `${formatSpeed(video.playbackRate)}x`;

    sliderRow.appendChild(sliderInput);
    sliderRow.appendChild(sliderValSpan);

    menuPanel.appendChild(menuTitle);
    menuPanel.appendChild(gridTarget);
    menuPanel.appendChild(sliderRow);

    // 3. Robust Insertion Phase using safe element.before() wrapper
    try {
      const settingsBtn = controls.querySelector('.ytp-settings-button');
      if (settingsBtn) {
        settingsBtn.before(controlButton);
      } else {
        controls.appendChild(controlButton);
      }
      player.appendChild(menuPanel);
    } catch (err) {
      return;
    }

    // Tooltip — appended to player root so it sits above the progress bar,
    // matching how YouTube positions its own control-bar tooltips
    const existingTip = player.querySelector('#ytp-custom-speed-tooltip');
    if (existingTip) existingTip.remove();
    const tooltip = document.createElement('div');
    tooltip.id = 'ytp-custom-speed-tooltip';
    tooltip.className = 'ytp-custom-speed-tooltip';
    tooltip.textContent = 'Playback speed (Shift+< / Shift+>)';
    player.appendChild(tooltip);

    const showTip = () => {
      if (menuPanel.classList.contains('show')) return;
      const btnRect = controlButton.getBoundingClientRect();
      const playerRect = player.getBoundingClientRect();
      // Horizontal: center on the button
      tooltip.style.left = `${btnRect.left - playerRect.left + btnRect.width / 2}px`;
      // Vertical: anchor to the TOP of .ytp-chrome-bottom (the whole scrubber + controls
      // row), not just the button top — this is how YouTube's own tooltips clear the timeline
      const chromeBottom = player.querySelector('.ytp-chrome-bottom');
      const refTop = chromeBottom
        ? chromeBottom.getBoundingClientRect().top
        : btnRect.top;
      tooltip.style.bottom = `${playerRect.bottom - refTop + 8}px`;
      tooltip.classList.add('visible');
    };
    const hideTip = () => tooltip.classList.remove('visible');

    controlButton.addEventListener('mouseenter', showTip);
    controlButton.addEventListener('mouseleave', hideTip);

    // Toggle Display Listeners
    controlButton.addEventListener('click', (e) => {
      e.stopPropagation();
      hideTip();
      menuPanel.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!menuPanel.contains(e.target) && e.target !== controlButton) {
        menuPanel.classList.remove('show');
      }
    });

    // Continuous slider control
    const slider = menuPanel.querySelector('#ytp-custom-speed-slider');
    const sliderVal = menuPanel.querySelector('#ytp-custom-slider-val');
    slider.addEventListener('input', () => {
      const rate = parseFloat(slider.value);
      video.playbackRate = rate;
      sliderVal.textContent = `${formatSpeed(rate)}x`;
    });

    // Mirror updates when native scripts or shortcuts alter playback speed
    video.removeEventListener('ratechange', handleRateChange);
    video.addEventListener('ratechange', handleRateChange);

    renderGridItems();
  }

  function formatSpeed(speed) {
    return Math.round(speed * 100) / 100;
  }

  function handleRateChange(e) {
    const rate = e.target.playbackRate;

    const txtSpan = document.getElementById('ytp-custom-speed-val');
    if (txtSpan) txtSpan.textContent = `${formatSpeed(rate)}x`;

    const slider = document.getElementById('ytp-custom-speed-slider');
    const sliderVal = document.getElementById('ytp-custom-slider-val');
    if (slider) slider.value = Math.min(Math.max(rate, SLIDER_MIN), SLIDER_MAX).toString();
    if (sliderVal) sliderVal.textContent = `${formatSpeed(rate)}x`;

    highlightActiveSpeed(rate);
  }

  // Grid Layout Builder
  function renderGridItems() {
    const gridContainer = document.getElementById('ytp-speed-grid-target');
    const player = document.querySelector('ytd-watch-flexy #movie_player') || document.querySelector('.html5-video-player');
    if (!gridContainer || !player) return;

    const video = player.querySelector('video');
    if (!video) return;

    // Completely avoid innerHTML = '' to satisfy linter constraints entirely
    while (gridContainer.firstChild) {
      gridContainer.removeChild(gridContainer.firstChild);
    }

    activeSpeeds.forEach(speed => {
      const item = document.createElement('div');
      item.className = 'ytp-custom-speed-item';
      item.textContent = `${formatSpeed(speed)}x`;

      if (video.playbackRate === speed) {
        item.classList.add('active');
      }

      item.addEventListener('click', () => {
        video.playbackRate = speed;
        const panel = document.getElementById('ytp-custom-speed-panel');
        if (panel) panel.classList.remove('show');
      });

      gridContainer.appendChild(item);
    });
  }

  function highlightActiveSpeed(currentRate) {
    const items = document.querySelectorAll('.ytp-custom-speed-item');
    items.forEach(item => {
      const itemSpeed = parseFloat(item.textContent);
      if (Math.abs(itemSpeed - currentRate) < 0.001) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // Persistent Polling Loop to counter YouTube dynamic SPA route cleanups
  function initializeEngine() {
    if (uiCheckInterval) clearInterval(uiCheckInterval);

    injectSpeedController();
    updateSpeedConfiguration();
    setupKeyboardShortcuts();

    uiCheckInterval = setInterval(() => {
      const isVideoPage = location.pathname.startsWith('/watch');
      if (isVideoPage) {
        injectSpeedController();
      }
    }, 500);
  }

  initializeEngine();
})();