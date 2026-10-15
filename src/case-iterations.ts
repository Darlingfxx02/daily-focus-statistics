import iterationData from './case-iterations-data.json';

interface Iteration {
  file: string;
  title: string;
  caption: string;
  width: number;
  height: number;
  crop: number[];
}

export const iterations: Record<string, Iteration[]> = iterationData;
export const iterationUrl = (file: string): string => `${import.meta.env.BASE_URL}assets/iterations/${file}`;

/** Saved versions of our UI, distinct from the external inspiration rails. */
export function iterationStrip(stage: number): string {
  const items = iterations[String(stage)];
  if (!items) return '';
  return `<div class="case-iterations" aria-label="Промежуточные версии интерфейса">${items.map((item, index) => {
    const [x, y, width, height] = item.crop;
    return `<figure class="iteration-card">
      <button class="iteration-open" type="button" data-iteration="${stage}:${index}" aria-label="Увеличить: ${item.title}">
        <span class="iteration-crop" style="aspect-ratio:${width}/${height}"><img src="${iterationUrl(item.file)}" alt="${item.title}" width="${item.width}" height="${item.height}" loading="lazy" decoding="async" style="width:${item.width / width * 100}%;left:${-x / width * 100}%;top:${-y / height * 100}%" /></span>
      </button>
      <figcaption><strong>${item.title}</strong><span>${item.caption}</span></figcaption>
    </figure>`;
  }).join('')}</div>`;
}
