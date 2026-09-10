// Override native dialog APIs so they never block the page event loop.
// Runs at document_start in MAIN world, before any page script can call alert().
(function overrideDialogs() {
  const noop = () => undefined;
  // Auto-accept confirm() (return true so form submission continues),
  // ignore alert()/prompt() entirely.
  try {
    window.alert = noop;
    window.confirm = () => true;
    window.prompt = () => null;
  } catch {
    // Some pages freeze window.* — silently skip.
  }
})();