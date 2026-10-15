export type BeforeAnchor = 'overview' | 'calendar' | 'food' | 'activity' | 'water' | 'steps' | 'weight' | 'navigation';
export type AfterAnchor = 'focus' | 'progress' | 'water-focus' | 'calendar' | 'food' | 'activity' | 'widgets' | 'navigation' | 'system';
export interface CaseScene {
  id: string;
  title: string;
  paragraphs: string[];
  before: BeforeAnchor[];
  after: AfterAnchor[];
  beforeScroll: number;
  afterScroll: 'top' | 'bottom' | AfterAnchor;
  readingSeconds: number;
}

// Coordinates come from the original Figma frame 1:1747 (390 × 1238).
export const beforeAnchors: Record<BeforeAnchor, { x: number; y: number; width: number; height: number }> = {
  overview: { x: 16, y: 109, width: 358, height: 307 },
  calendar: { x: 16, y: 109, width: 358, height: 109 },
  food: { x: 16, y: 234, width: 358, height: 182 },
  activity: { x: 16, y: 420, width: 358, height: 206 },
  water: { x: 16, y: 630, width: 358, height: 128 },
  steps: { x: 16, y: 762, width: 358, height: 128 },
  weight: { x: 16, y: 1034, width: 358, height: 100 },
  navigation: { x: 0, y: 1154, width: 390, height: 84 },
};

// Each scene restores day 17 and both scroll positions independently. Reading
// times describe the amount of copy; they never advance the tour automatically.
export const caseScenes: CaseScene[] = [
  {
    id: 'daily-orientation', title: 'Три фокуса вместо всего сразу',
    paragraphs: [
      'В обзоре — только три направления. Предполагаем, что посильный объём снизит ощущение перегруза и побудит чаще выполнять цели, заполняя плашки.',
      'В концепции алгоритм подбирает и меняет фокусы под потребности человека по его целям и истории активности. Подробные карточки остаются ниже; питание и активность — первые.',
    ],
    before: ['overview'], after: ['focus'], beforeScroll: 0, afterScroll: 'top', readingSeconds: 17,
  },
  {
    id: 'readable-progress', title: 'Прогресс — в образе и цифрах',
    paragraphs: [
      'Иллюстрация окрашивается по мере выполнения цели. Цвет связан с категорией: синяя вода, оранжевый огонь, зелёное питание.',
      'Под ней — значение, цель и единицы: прогресс понятен и без цвета. Закрывать все три фокуса необязательно; каждый учитывается отдельно.',
    ],
    before: ['water'], after: ['water-focus'], beforeScroll: 390, afterScroll: 'top', readingSeconds: 13,
  },
  {
    id: 'days', title: 'Достижения видны в календаре',
    paragraphs: [
      'Под каждой датой — до трёх точек за выполненные фокусы. Цвет обозначает категорию.',
      'Календарь расположен под обзором. При смене дня меняются иконки и заполнение, цифры остаются на месте. От закрепления календаря отказались, чтобы упростить прокрутку.',
    ],
    before: ['calendar'], after: ['calendar'], beforeScroll: 0, afterScroll: 'calendar', readingSeconds: 12,
  },
  {
    id: 'hierarchy', title: 'Меньше рамок, яснее иерархия',
    paragraphs: [
      'Убрали обводки: белые карточки разделены отступами на светло-сером фоне. Меньше деталей конкурируют за внимание.',
      'В питании сначала итог, под разделителем — БЖУ: числа сверху, подписи снизу. Заголовки и одинаковые «плюсы» выровнены; лишние рамки у кнопок убраны.',
    ],
    before: ['food'], after: ['food'], beforeScroll: 125, afterScroll: 'food', readingSeconds: 13,
  },
  {
    id: 'activity', title: 'Шаги показываем один раз',
    paragraphs: [
      'Удалили отдельную карточку шагов. Значение и серая цель остались в активности: 5 301 / 10 000. Вместо повторных подписей — иконки рядом с числами.',
      'Процент подняли к килокалориям, освободив шкале всю ширину. Так же выровняли процент сна.',
    ],
    before: ['activity', 'steps'], after: ['activity'], beforeScroll: 350, afterScroll: 'activity', readingSeconds: 13,
  },
  {
    id: 'secondary', title: 'Вода и вес — компактнее',
    paragraphs: [
      'Две квадратные карточки заменили отдельные строки. Иллюстрации заполняются как в фокусах дня и не перекрывают заголовки.',
      'У веса оставили только значение / цель, убрав лишние проценты и подписи. Заполнение показывает путь от старта к цели; в демо — набор с 60 до 65 кг.',
    ],
    before: ['water', 'weight'], after: ['widgets'], beforeScroll: 390, afterScroll: 'widgets', readingSeconds: 15,
  },
  {
    id: 'navigation', title: 'Навигация всегда под рукой',
    paragraphs: [
      'Панель заменили компактной пилюлей с подписями. Она закреплена, содержимое плавно скрывается под полупрозрачной белой подложкой. Часы и индикаторы тоже закреплены и меняют цвет под фон.',
      'Анимируются иконки и заполнение, цифры не сдвигаются. При уменьшении движения в настройках системы результат виден сразу.',
    ],
    before: ['navigation'], after: ['navigation', 'system'], beforeScroll: 390, afterScroll: 'bottom', readingSeconds: 14,
  },
  {
    id: 'limits', title: '«Прогресс» — история успехов',
    paragraphs: [
      'Предложенная фича: кнопка открывает историю выполненных фокусов и динамику за период. Прошлые успехи должны поддерживать мотивацию возвращаться и продолжать.',
      'Основная метрика проверки — доля выполненных из трёх фокусов за день. Дополнительно — возвраты к истории и удержание. Персонализация и раздел «Прогресс» — концепция следующего этапа.',
    ],
    before: [], after: ['focus', 'progress'], beforeScroll: 0, afterScroll: 'top', readingSeconds: 18,
  },
];
