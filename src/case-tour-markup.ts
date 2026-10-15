import { beforeAnchors, caseScenes } from './case-scenes';
import { deviceFrameUrl, deviceStyle } from './device-shell';

export function beforeDevice(): string {
  const anchors = Object.entries(beforeAnchors).map(([id, r]) => `<span class="original-anchor" data-before-anchor="${id}" style="left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px"></span>`).join('');
  return `<div class="device-column" data-case-device="before"><h2 class="device-caption">До</h2><aside class="case-preview before-preview" aria-label="Исходный экран из тестового задания" style="${deviceStyle}"><div class="device-shell"><div class="device-screen"><div class="before-app"><div class="before-scroll" tabindex="0" aria-label="Прокрутка исходного экрана"><div class="original-canvas"><img class="original-screenshot" src="${import.meta.env.BASE_URL}assets/comparison/original-statistics.png" alt="Исходная статистика: календарь, питание, активность, вода, отдельные шаги, сон и вес" width="438" height="1286" />${anchors}</div></div></div></div><img class="device-frame" src="${deviceFrameUrl}" alt="" draggable="false" /></div></aside></div>`;
}

export function tourPanel(): string {
  return `<div class="tour-explanation"><div class="tour-copy" tabindex="0" role="region" aria-label="Описание этапа" aria-live="polite"><div class="tour-copy-content"><h2 id="tour-title"></h2><div id="tour-body"></div></div></div>${tourNavigation()}</div>`;
}

export function tourNavigation(intro = false): string {
  return `<div class="tour-controls"><button type="button" data-tour="previous" aria-label="Предыдущий шаг" ${intro ? 'disabled' : ''}>←</button><span data-tour-position>${intro ? 1 : 2} / ${caseScenes.length + 1}</span><button type="button" data-tour="next" aria-label="${intro ? 'Перейти к сравнению' : 'Следующий шаг'}">→</button><button type="button" class="tour-free" data-tour="free" aria-haspopup="dialog">Исследовать макет</button></div><p class="tour-instruction">${intro ? 'Начните со стрелки → или прокрутите вниз.' : 'Листайте или переключайте стрелками.'}</p>`;
}

export function tourTrack(): string {
  return `<div class="tour-track" aria-label="Этапы сравнения"><div class="tour-intro-stop" aria-hidden="true"></div>${caseScenes.map((s, i) => `<section class="tour-stop" id="comparison-${s.id}" data-scene="${i}" aria-label="${s.title}"><span class="sr-only">${s.title}</span></section>`).join('')}</div>`;
}
