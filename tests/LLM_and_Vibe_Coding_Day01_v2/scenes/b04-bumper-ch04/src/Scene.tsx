import { defineScene } from '@vanilla/runtime';
import { BUMPER_SECONDS, bumperParams, makeBumper } from '../../../shared/bumper/Bumper';
import { sceneJsonId } from '../../../shared/deck/content';

// Motion-reel chapter bumper (shared/bumper) opening ch04. Copy, motif and color field live in content.json (bumpers).
export default defineScene({ id: sceneJsonId('bumper-ch04'), duration: BUMPER_SECONDS, params: bumperParams, Component: makeBumper('ch04') });
