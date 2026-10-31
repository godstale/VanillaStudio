import { defineComposition } from '@vanilla/runtime';
import scene from './Scene';

// Slides: no duration, the scene advances on user input only (D-032).
export default defineComposition({ scenes: [scene] });
