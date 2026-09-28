export function getCSRFToken() {
  return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
}

export const PIXELS_PER_MINUTE = 64 / 60;
