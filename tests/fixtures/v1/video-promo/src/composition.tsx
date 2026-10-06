import { defineComposition } from '@vanilla/runtime';
import intro from './scenes/intro';
import main from './scenes/main';

export default defineComposition({ scenes: [intro, main], format: { width: 1920, height: 1080 } });
