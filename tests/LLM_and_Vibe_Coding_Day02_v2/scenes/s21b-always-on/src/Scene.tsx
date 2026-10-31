import { defineScene } from '@vanilla/runtime';
import { DeckShell } from '../../../shared/deck/DeckShell';
import { sceneJsonId } from '../../../shared/deck/content';

// Copy and screens live in storyboard/data/content.json (s21b); layouts in shared/deck.
const KEY = 's21b';

function Slide() {
  return <DeckShell sceneKey={KEY} />;
}

export default defineScene({ id: sceneJsonId(KEY), Component: Slide });
