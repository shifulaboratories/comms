import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Fonts for the generated share images. Satori (behind next/og) can't use the
 * woff2 files next/font ships, so the TTFs are vendored in assets/og and read
 * at build time — no network fetch, so the build can't fail on a font CDN.
 * All three are SIL Open Font License.
 */
export async function ogFonts() {
  const dir = path.join(process.cwd(), 'assets/og');
  const [regular, semibold, serif] = await Promise.all([
    readFile(path.join(dir, 'Geist-Regular.ttf')),
    readFile(path.join(dir, 'Geist-SemiBold.ttf')),
    readFile(path.join(dir, 'InstrumentSerif-Italic.ttf')),
  ]);
  return [
    { name: 'Geist', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Geist', data: semibold, weight: 600 as const, style: 'normal' as const },
    { name: 'Instrument Serif', data: serif, weight: 400 as const, style: 'italic' as const },
  ];
}
