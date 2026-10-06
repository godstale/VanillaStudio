import { defineComposition } from '@vanilla/runtime';
import hero from './scenes/hero';
import features from './scenes/features';

export default defineComposition({ scenes: [hero, features], time: 'free', layout: 'sections' });
