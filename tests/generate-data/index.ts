import { createBundle } from './build/create-bundle';
import { generateBig } from './build/big';
import { generateFooMin } from './build/foo-min';
import { generateInlineMap } from './build/inline-map';
import { generateInvalidMapColumn } from './build/invalid-map-column';
import { generateInvalidMapLine } from './build/invalid-map-line';
import { generateMapReferenceEOL } from './build/map-reference-eol';
import { generateNoMapComment } from './build/no-map-comment';
import { generateNullSource } from './build/null-source';
import { generateOneSource } from './build/one-source';
import { generateWithUnmapped } from './build/with-unmapped';

createBundle().then(() => {
  generateBig();
  generateFooMin();
  generateInlineMap();
  generateInvalidMapColumn();
  generateInvalidMapLine();
  generateMapReferenceEOL();
  generateNoMapComment();
  generateNullSource();
  generateOneSource();
  generateWithUnmapped();
});
