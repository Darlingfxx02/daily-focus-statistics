import referenceData from './case-references-data.json';
import { iterations, iterationUrl } from './case-iterations';

interface Reference {
  file: string;
  label: string;
  source: string;
  width: number;
  height: number;
  wide?: boolean;
}

const references: Record<string, Reference[]> = referenceData;
const imageUrl = (file: string): string => `${import.meta.env.BASE_URL}assets/references/${file}`;
const escape = (value: string): string => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

export function referenceStrip(stage: number): string {
  const items = references[String(stage)];
  if (!items) return '';
  return `<div class="reference-rail"><div class="reference-scroll" tabindex="0" role="region" aria-label="Референсы к этапу ${stage}. Листайте влево или вправо; нажмите изображение, чтобы увеличить.">${items.map((reference, index) =>
    `<figure class="reference-card${reference.wide ? ' reference-card-wide' : ''}"><button class="reference-open" type="button" data-reference="${stage}:${index}" aria-label="Увеличить: ${escape(reference.label)}"><img src="${imageUrl(reference.file)}" alt="${escape(reference.label)}" width="${reference.width}" height="${reference.height}" loading="lazy" decoding="async" /></button></figure>`
  ).join('')}</div></div>`;
}

export function referenceViewer(): string {
  return `<dialog class="reference-dialog" id="reference-dialog" aria-labelledby="reference-caption"><div class="reference-dialog-content"><div class="reference-toolbar"><button type="button" data-reference-close>Закрыть</button></div><img id="reference-image" alt="" /><p id="reference-caption"></p></div></dialog>`;
}

export function setupCaseReferences(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#reference-dialog')!;
  const image = document.querySelector<HTMLImageElement>('#reference-image')!;
  const description = document.querySelector<HTMLElement>('#reference-caption')!;
  let opener: HTMLButtonElement | undefined;

  document.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-reference], [data-iteration]');
    if (!button) return;
    const [stage, index] = (button.dataset.iteration ?? button.dataset.reference)!.split(':');
    if (button.dataset.iteration) {
      const iteration = iterations[stage][Number(index)];
      image.src = iterationUrl(iteration.file);
      image.alt = iteration.title;
      description.textContent = `${iteration.title}. ${iteration.caption}`;
    } else {
      const reference = references[stage][Number(index)];
      image.src = imageUrl(reference.file);
      image.alt = reference.label;
      description.textContent = reference.label;
    }
    opener = button;
    dialog.showModal();
  });
  dialog.querySelector('[data-reference-close]')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));
}
