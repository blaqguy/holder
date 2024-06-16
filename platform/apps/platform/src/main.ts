import { DragonflyPlatform } from './app/platform';
import './environments/environment';
import { fetchSopsData } from './helpers';
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('source-map-support').install();

console.log('Preparing Dragonfly for takeoff...');

Promise.all([fetchSopsData()])
  .then((data) => {
    new DragonflyPlatform(data[0]);
  })
  .catch((err) => {
    console.log(err);
    throw err;
  });
