import { defineComposition } from '@vanilla/runtime';
import s1 from './scenes/s1';
import s2 from './scenes/s2';
import s3 from './scenes/s3';

export default defineComposition({ scenes: [s1, s2, s3], time: 'free', layout: 'sections' });
