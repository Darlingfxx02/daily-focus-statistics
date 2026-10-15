import device from './device.json';

// Keep the app at its existing 390 px viewport; scale the entire device together.
const unit = 390 / device.screen.width;
const shellWidth = device.width * unit;
export const deviceFrameUrl = `${import.meta.env.BASE_URL}${device.frame}`;
export const deviceLabel = `${device.model} · ${device.color}`;
export const deviceStyle = [
  `--shell-width:${shellWidth}px`,
  `--shell-height:${device.height * unit}px`,
  `--shell-ratio:${device.width / device.height}`,
  `--screen-x:${device.screen.x * unit}px`,
  `--screen-y:${device.screen.y * unit}px`,
  '--screen-width:390px',
  `--screen-height:${device.screen.height * unit}px`,
  `--screen-radius:${device.screen.radius}`,
].join(';');

export function fitDeviceShell(host: HTMLElement): () => void {
  const fit = (): void => {
    host.style.setProperty('--device-scale', String(host.clientWidth / shellWidth));
  };
  fit();
  const observer = new ResizeObserver(fit);
  observer.observe(host);
  return () => observer.disconnect();
}
