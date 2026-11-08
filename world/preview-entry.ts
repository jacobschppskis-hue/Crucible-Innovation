// The single-file preview's script: the same world the site mounts (components/world/WorldMount.tsx), without React.
// Bundled by world/build-preview.mjs into world/dist/crucible.html.
import { startWorld } from '@/lib/world';

const de = document.documentElement;
de.classList.add('js');
de.setAttribute('data-world', '');
de.setAttribute('data-preview', '');
const root = document.querySelector<HTMLElement>('[data-world-root]') ?? document.body;
const go = () => startWorld(root).catch((e) => console.warn('[world]', e));
if (document.readyState === 'complete') go();
else addEventListener('load', go, { once: true });
