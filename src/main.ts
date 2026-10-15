import '@fontsource-variable/inter';
import './style.css';
import './case-study.css';
import { caseIntroduction, decisionChronology } from './case-study';
import { referenceViewer, setupCaseReferences } from './case-references';
import { image, type Asset } from './assets';
import { animateLiquidFocus, captureLiquidFocus, liquidFocusTiles } from './liquid-focus';
import { animateStatsChange, captureStats } from './stats-motion';
import { animateWidgetIcon, widgetIllustration } from './widget-icons';
import { deviceFrameUrl, deviceLabel, deviceStyle, fitDeviceShell } from './device-shell';
import { beforeDevice, tourPanel, tourTrack } from './case-tour-markup';
import { setupCaseTour } from './case-tour';
import { createCaseAdapter } from './case-app-adapter';
import './case-tour.css';
import { weightStart, weightProgress } from './data';
import { completedFocuses, dayRecord, days, demoDay, emptyData, focusesFor, focusLabels, focusProgressFor, number, percent, targets, waterInMl, type DayData, type Metric } from './data';

const app = document.querySelector<HTMLDivElement>('#app')!;
let selectedDay: number = demoDay;

function plus(metric: Metric, label: string): string {
  return `<button class="add-button" type="button" data-add="${metric}" aria-label="${label}" disabled>${image('plus')}</button>`;
}

function title(icon: Asset, text: string): string {
  return `<h2 class="card-title">${image(icon)}<span>${text}</span></h2>`;
}

function value(amount: string, goal: string, unit = ''): string {
  return `<div class="main-value"><strong>${amount}</strong><span class="goal">/ ${goal}${unit ? `<span class="unit">${unit}</span>` : ''}</span></div>`;
}

function bar(amount: number, goal: number, showValue = true): string {
  const progress = percent(amount, goal);
  return `<div class="progress-row"><div class="progress-track" role="progressbar" aria-label="Выполнение дневного ориентира" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(progress, 100)}"><span style="width:${Math.min(progress, 100)}%"></span></div>${showValue ? `<span class="progress-number">${progress}<span>%</span></span>` : ''}</div>`;
}

function macro(name: string, amount: number, goal: number, color: string, initialWidth: number): string {
  const width = selectedDay === demoDay ? initialWidth : Math.min(percent(amount, goal), 100);
  return `<div class="macro" style="--macro-color:${color}"><div class="macro-value"><b>${amount}</b><span>/ ${goal} г</span></div><div class="macro-bar"><span style="width:${width}%"></span></div><div class="macro-label"><i></i>${name}</div></div>`;
}

function cards(data: DayData): string {
  const hours = Math.floor(data.sleep / 60);
  const minutes = data.sleep % 60;
  const weight = weightProgress(data.weight, weightStart, targets.weight);
  return `
    <article class="stat-card food-card" id="food" data-node-id="48:2339">
      <div class="meal-top">${title('food', 'Питание')}${value(number(data.food), '1 800', 'ккал')}</div>
      ${plus('food', 'Добавить питание')}
      <div class="divider" aria-hidden="true">${image('activityDivider')}</div>
      <div class="macros">${macro('Белки', data.protein, 93, '#5a4ff5', 33)}${macro('Жиры', data.fat, 48, '#9b48f4', 25)}${macro('Углеводы', data.carbs, 48, '#f17c59', 24)}</div>
    </article>
    <article class="stat-card activity-card" id="activity" data-node-id="48:2340">
      ${title('activity', 'Активность')}${plus('activity', 'Добавить активность')}
      <div class="activity-values"><div class="activity-summary">${value(number(data.activity), '427', 'ккал')}<span class="progress-number">${percent(data.activity, targets.activity)}<span>%</span></span></div>${bar(data.activity, targets.activity, false)}</div>
      <div class="divider">${image('activityDivider')}</div>
      <div class="activity-details"><div><span class="sr-only">Шаги: </span>${image('smallSteps')}<b class="steps-total">${number(data.steps)}<span>/ ${number(targets.steps)}</span></b></div><div><span class="sr-only">Тренировка: </span>${image('training')}<b>${data.training}<span>мин</span></b></div></div>
    </article>
    <div class="square-widgets">
    <article class="stat-card square-widget water-card" id="water" data-node-id="48:2348">
      ${widgetIllustration('water', Math.min(1, data.water / targets.water), `${waterInMl(data.water)} из ${waterInMl(targets.water)} мл`)}
      ${title('water', 'Вода')}${plus('water', 'Добавить воду')}
      <div class="widget-reading">${value(number(waterInMl(data.water)), number(waterInMl(targets.water)), 'мл')}</div>
    </article>
    <article class="stat-card square-widget weight-card" id="weight" data-node-id="48:2414">
      ${widgetIllustration('weight', weight?.level ?? 0, weight ? `${number(data.weight!)} из ${number(targets.weight)} кг` : 'За этот день нет измерения веса')}
      ${title('weight', 'Вес')}${plus('weight', 'Добавить вес')}
      <div class="widget-reading">${value(data.weight === null ? '—' : number(data.weight), number(targets.weight), 'кг')}</div>
    </article>
    </div>
    <article class="stat-card sleep-card" id="sleep" data-node-id="48:2403">
      ${title('sleep', 'Сон')}${plus('sleep', 'Добавить сон')}
      <div class="compact-values"><div class="sleep-summary"><div class="sleep-value"><span><strong>${hours}</strong><small>ч</small></span><span><strong>${minutes}</strong><small>мин</small></span><span class="goal">/ 8 ч 30 мин</span></div><span class="progress-number">${percent(data.sleep, targets.sleep)}<span>%</span></span></div>${bar(data.sleep, targets.sleep, false)}</div>
    </article>`;
}

function calendarDay({ day, label }: typeof days[number]): string {
  const completed = completedFocuses(day);
  const status = completed.length ? `Закрыто фокусов: ${completed.length} — ${completed.map(focus => focusLabels[focus]).join(', ')}` : 'Нет закрытых фокусов';
  return `<button type="button" data-day="${day}" class="day ${day === selectedDay ? 'selected' : ''} ${day > demoDay ? 'future' : ''}" aria-label="${day} сентября 2026. ${status}" aria-pressed="${day === selectedDay}"><span class="weekday">${label}</span><span>${day}</span><span class="day-focuses" aria-hidden="true">${completed.map(focus => `<span class="focus-dot" data-focus="${focus}"></span>`).join('')}</span></button>`;
}

function calendar(): string {
  return `<section class="calendar" aria-label="Выбор дня" data-node-id="156:5512">
    <div class="calendar-heading"><div class="month-label"><span>Сентябрь 2026</span></div><button class="calendar-button" type="button" aria-label="Открыть календарь" data-action="calendar">${image('calendar')}</button></div>
    <div class="divider calendar-divider" aria-hidden="true">${image('calendarDivider')}</div>
    <div class="week">${days.map(calendarDay).join('')}</div>
  </section>`;
}

function focus(): string {
  const focuses = focusesFor(selectedDay);
  const progress = focuses.map(focus => focusProgressFor(selectedDay, focus));
  const description = focuses.map((focus, index) => `${focusLabels[focus]} ${Math.round(progress[index] * 100)}%`).join(', ');
  return `<section class="daily-focus" aria-labelledby="focus-title" data-node-id="156:5559">
    <div class="focus-heading"><h2 id="focus-title">Фокус дня</h2><button class="help-button" type="button" aria-label="Как выбирается фокус дня" data-action="help">${image('help')}</button></div>
    ${liquidFocusTiles(focuses, progress, `Фокус дня: ${description}. ${dayRecord(selectedDay) ? `Закрыто фокусов: ${completedFocuses(selectedDay).length} из 3.` : 'За этот день ещё нет записей.'}`, dayRecord(selectedDay)?.data ?? emptyData)}
  </section>`;
}

function statusBar(): string {
  return `<div class="status-bar" aria-hidden="true"><span class="time">20:01</span><div class="status-levels">${image('cellular')}${image('wifi')}<span class="battery"><span></span>${image('batteryCap')}</span></div></div>`;
}

function scrollFade(edge: 'top' | 'bottom'): string {
  if (edge === 'bottom') return '<div class="scroll-fade bottom-scroll-fade" aria-hidden="true"></div>';
  // Overlapping translucent filters soften continuously without thin clipped
  // strips or backdrop masks (which are ignored by this preview compositor).
  const maxBlur = 32;
  const layers = Array.from({ length: 24 }, (_, index) => {
    const t = index / 23;
    return `<span style="--depth:${100 - t * 68}%;--blur:${(.5 + t * (maxBlur - .5)).toFixed(2)}px;--blend:${(.1 + t * .3).toFixed(3)}"></span>`;
  }).join('');
  return `<div class="scroll-fade ${edge}-scroll-fade" aria-hidden="true">${layers}</div>`;
}

app.innerHTML = `
  <main class="case-canvas">
  <section class="case-presentation" aria-label="Сравнение и история работы">
  <div class="comparison-stage" id="interactive-prototype">
  ${caseIntroduction()}
  ${tourPanel()}
  <div class="compare-devices">
  ${beforeDevice()}
  <div class="device-column" data-case-device="after"><h2 class="device-caption">После</h2>
  <aside class="case-preview" aria-label="Интерактивный прототип — ${deviceLabel}" style="${deviceStyle}">
  <div class="device-shell">
  <div class="device-screen">
  <div class="phone" data-node-id="156:5508">
    <section class="main-scroll" id="statistics" aria-label="Дневная статистика"><div class="main-content"><div id="daily-content"></div></div></section>
    <div class="system-header">${scrollFade('top')}${statusBar()}</div>
    ${scrollFade('bottom')}
    <nav class="tabbar" aria-label="Разделы приложения">
      <div class="tabbar-items">
        <button class="tab active" type="button" aria-current="page" data-action="top"><span class="tab-icon">${image('statistics')}</span><span class="tab-label">Статистика</span></button>
        <button class="tab coach" type="button" disabled><span class="tab-icon">${image('coach')}</span><span class="tab-label">ИИ-коуч</span></button>
        <button class="tab" type="button" disabled><span class="tab-icon">${image('profile')}</span><span class="tab-label">Профиль</span></button>
      </div>
    </nav>
    <div class="home-indicator" aria-hidden="true"></div>
    <div class="phone-overlay" hidden><dialog class="phone-dialog" id="dialog" aria-labelledby="dialog-title"><div class="dialog-content" id="dialog-content"></div></dialog></div>
  </div>
  </div>
  <img class="device-frame" src="${deviceFrameUrl}" alt="" aria-hidden="true" draggable="false" />
  </div>
  </aside>
  </div></div>
  <svg class="tour-overlay" aria-hidden="true"></svg>
  </div>
  ${tourTrack()}
  <div class="tour-exit" aria-hidden="true"></div>
  ${decisionChronology()}
  </section>
  </main>
  ${referenceViewer()}
  <div id="announcement" class="sr-only" role="status" aria-live="polite"></div>`;

const stopDeviceFitting = [...document.querySelectorAll<HTMLElement>('.case-preview')].map(fitDeviceShell);
import.meta.hot?.dispose(() => stopDeviceFitting.forEach(stop => stop()));
const content = document.querySelector<HTMLDivElement>('#daily-content')!;
const dialog = document.querySelector<HTMLDialogElement>('#dialog')!;
const phoneOverlay = document.querySelector<HTMLElement>('.phone-overlay')!;
const phoneBackground = document.querySelectorAll<HTMLElement>('.phone > .main-scroll, .phone > .tabbar');
const dialogContent = document.querySelector<HTMLDivElement>('#dialog-content')!;
const scrollArea = document.querySelector<HTMLElement>('.main-scroll')!;
const systemHeader = document.querySelector<HTMLElement>('.system-header')!;
let statusToneThreshold = 0;
function measureStatusTone(): void {
  const hero = content.querySelector<HTMLElement>('.progress-hero');
  if (!hero) return;
  // Switch before the first white tiles pass behind the status indicators,
  // then keep one stable dark style throughout the light content below.
  const tiles = hero.querySelector<HTMLElement>('.liquid-focus');
  if (!tiles) return;
  const tilesTop = tiles.getBoundingClientRect().top - hero.getBoundingClientRect().top;
  const scale = hero.getBoundingClientRect().height / hero.offsetHeight;
  statusToneThreshold = tilesTop / scale - systemHeader.clientHeight;
  syncStatusTone();
}
function syncStatusTone(top = scrollArea.scrollTop): void {
  const tone = top > statusToneThreshold ? 'dark' : 'light';
  const scrolled = String(top > 1);
  if (systemHeader.dataset.tone !== tone) systemHeader.dataset.tone = tone;
  if (systemHeader.dataset.scrolled !== scrolled) systemHeader.dataset.scrolled = scrolled;
}
const onAppScroll = () => syncStatusTone();
scrollArea.addEventListener('scroll', onAppScroll, { passive: true });
window.addEventListener('resize', measureStatusTone);
import.meta.hot?.dispose(() => {
  scrollArea.removeEventListener('scroll', onAppScroll);
  window.removeEventListener('resize', measureStatusTone);
});
let returnFocus: HTMLElement | null = null;
let stopFocusMotion = () => {};
let stopStatsMotion = () => {};
let stopWidgetMotion: Array<() => void> = [];

function render(): void {
  const oldFocus = content.querySelector<HTMLElement>('.liquid-focus');
  const previousFocus = oldFocus ? captureLiquidFocus(oldFocus) : undefined;
  const previousStats = oldFocus ? captureStats(content) : undefined;
  const previousWidgets = new Map([...content.querySelectorAll<HTMLElement>('[data-widget-metric]')].map(node => [node.dataset.widgetMetric, Number(node.dataset.currentLevel ?? 0)]));
  stopFocusMotion();
  stopStatsMotion();
  stopWidgetMotion.forEach(stop => stop());
  const record = dayRecord(selectedDay);
  const data = record?.data ?? emptyData;
  content.innerHTML = `<section class="progress-hero" aria-label="Обзор дня" data-node-id="156:5511">${focus()}<button class="progress-button" type="button" aria-label="Открыть прогресс" data-case-anchor="progress" disabled><span>Прогресс</span></button>${calendar()}</section>${!record ? '<p class="empty-day">За этот день пока нет записей</p>' : ''}<div class="cards">${cards(data)}</div>`;
  const anchors: Record<string, string> = { focus: '.daily-focus', 'water-focus': '.liquid-tile[data-focus="water"]', calendar: '.calendar', food: '#food', activity: '#activity', widgets: '.square-widgets', navigation: '.tabbar', system: '.system-header' };
  Object.entries(anchors).forEach(([anchor, selector]) => { const node = document.querySelector<HTMLElement>(selector); if (node) node.dataset.caseAnchor = anchor; });
  stopFocusMotion = animateLiquidFocus(content.querySelector<HTMLElement>('.liquid-focus')!, scrollArea, previousFocus);
  stopStatsMotion = animateStatsChange(content, scrollArea, previousStats);
  stopWidgetMotion = [...content.querySelectorAll<HTMLElement>('[data-widget-metric]')].map(node => animateWidgetIcon(node, scrollArea, previousWidgets.get(node.dataset.widgetMetric)));
  measureStatusTone();
}

function openDialog(markup: string): void {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialogContent.innerHTML = markup;
  phoneOverlay.hidden = false;
  phoneBackground.forEach(element => { element.inert = true; });
  // Keep this dialog in the phone's stacking context, outside the document-wide top layer.
  dialog.show();
}

function closeDialog(): void {
  if (!dialog.open) return;
  dialog.close();
  phoneOverlay.hidden = true;
  phoneBackground.forEach(element => { element.inert = false; });
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  returnFocus = null;
}
phoneOverlay.addEventListener('click', event => { if (event.target === phoneOverlay) closeDialog(); });
dialog.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeDialog();
  }
  if (event.key === 'Tab') {
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus({ preventScroll: true });
    }
  }
});

function chooseDay(day: number): void {
  if (day === selectedDay || !days.some(item => item.day === day)) return;
  selectedDay = day;
  render();
  document.querySelector<HTMLButtonElement>(`.week [data-day="${day}"]`)?.focus({ preventScroll: true });
  document.querySelector('#announcement')!.textContent = `Выбрано ${day} сентября`;
}

document.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.dataset.day) {
    if (dialog.open) closeDialog();
    chooseDay(Number(button.dataset.day));
  }
  if (button.dataset.action === 'top') scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
  if (button.dataset.action === 'close') closeDialog();
  if (button.dataset.action === 'help') {
    openDialog(`<h2 id="dialog-title">Как выбирается фокус дня</h2><p>Фокус дня подбирается по вашим целям, средней активности и записям о питании. Если подключено расписание, учитываем и свободное время.</p><button type="button" class="primary-button" data-action="close" autofocus>Понятно</button>`);
  }
  if (button.dataset.action === 'calendar') {
    openDialog(`<h2 id="dialog-title">Сентябрь 2026</h2><p>Выберите день</p><div class="week calendar-picker">${days.map(calendarDay).join('')}</div><button type="button" class="primary-button" data-action="close">Закрыть</button>`);
  }
});

render();
setupCaseReferences();
const stopCaseTour = setupCaseTour(createCaseAdapter(() => {
  closeDialog();
  if (selectedDay !== 17) { selectedDay = 17; render(); }
}, syncStatusTone));
import.meta.hot?.dispose(stopCaseTour);
