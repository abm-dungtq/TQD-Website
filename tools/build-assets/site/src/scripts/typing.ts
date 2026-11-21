/** True when keystrokes belong to a text field, so global shortcuts should stay out of the way. */
export const typing = (el: Element | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
