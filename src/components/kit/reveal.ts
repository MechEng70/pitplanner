// Where to scroll so a focused field sits in the visible part of a scroll view: below its top edge and above
// a footer floating over its bottom (FooterScroll). Pure, so the arithmetic is unit tested; the measuring is
// in FooterScroll.

/** The field: its top in content coordinates, its top on screen and its height (dp). */
export interface FieldBox {
  contentTop: number;
  winTop: number;
  height: number;
}
/** The scroll view: its top on screen and the height not covered by the footer (dp). */
export interface ViewBox {
  top: number;
  visibleHeight: number;
}

/** The new scroll offset, or null when the field is already fully visible with `margin` around it. */
export function revealOffset(field: FieldBox, view: ViewBox, margin: number): number | null {
  const offset = field.contentTop - (field.winTop - view.top);
  const fieldTop = field.winTop - view.top;
  const fieldBottom = fieldTop + field.height;
  const tall = field.height + 2 * margin > view.visibleHeight;
  if (fieldTop < margin || tall) {
    if (fieldTop === margin) return null;
    return Math.max(0, field.contentTop - margin);
  }
  if (fieldBottom > view.visibleHeight - margin) return offset + fieldBottom - (view.visibleHeight - margin);
  return null;
}
