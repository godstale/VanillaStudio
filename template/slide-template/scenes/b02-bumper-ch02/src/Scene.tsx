import { defineScene } from '@vanilla/runtime';
import { BUMPER_DURATION, BumperView, bumperParams } from '../../../shared/bumper/Bumper';

// Copy lives in storyboard/data/content.json (chapters, bumper); picture and sting in shared/bumper.
const CHAPTER = 'ch02';

function Bumper() {
  return <BumperView chapterId={CHAPTER} />;
}

export default defineScene({ id: 'scn_995b21d02756', duration: BUMPER_DURATION, params: bumperParams, Component: Bumper });
