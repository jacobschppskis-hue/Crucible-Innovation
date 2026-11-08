// Lab stage: the real engine with the paypal module and its journey keys, on a page with story / paypal / story-2.
// Build: node lab/paypal/stage-build.mjs  ->  lab/paypal/stage.js ; open lab/paypal/stage.html?loop=0
import { startWorld } from '../../lib/world';
import { MODULES } from '../../lib/world/modules';
import { keys as journeyKeys, R } from '../../lib/world/journey';
import { paypal, paypalKeys, paypalDebug } from '../../lib/world/paypal';

// the beat's own camera, spliced in where the journey's paypal keys are (resolve() keeps list order)
const keys = () => {
  const all = journeyKeys();
  const i = all.findIndex((k) => k.at[0] === 'paypal');
  return [...all.slice(0, i), ...paypalKeys(R), ...all.slice(i).filter((k) => k.at[0] !== 'paypal')];
};
(window as unknown as { __pp: unknown }).__pp = paypalDebug;
const ready = document.fonts ? document.fonts.ready : Promise.resolve();
ready.then(() => startWorld(document.getElementById('root')!, { modules: [...MODULES.filter((m) => m.id !== 'paypal'), paypal] }));
void keys;
import { beatChannels } from '../../lib/world/paypal';
(window as unknown as { __ppExpect: unknown }).__ppExpect = (f: number, narrow: boolean) => beatChannels(f, narrow, R);
