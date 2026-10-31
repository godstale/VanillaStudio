import { defineScene } from '@vanilla/runtime';
import { DeckShell } from '../../../shared/deck/DeckShell';
import { sceneJsonId } from '../../../shared/deck/content';

// Copy and screens live in storyboard/data/content.json (s01); layouts in shared/deck.
const KEY = 's01';

function Slide() {
  return <DeckShell sceneKey={KEY} />;
}

export default defineScene({ id: sceneJsonId(KEY), Component: Slide });
