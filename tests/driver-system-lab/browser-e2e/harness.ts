export const DRIVER_HARNESS_HTML = String.raw`<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <title>Driver Test Harness</title>
    <style>
      body { font: 16px system-ui; margin: 2rem; }
      main { max-width: 32rem; }
      button, label { display: block; margin: .75rem 0; }
      [hidden] { display: none !important; }
    </style>
  </head>
  <body>
    <main data-testid="test-only-harness" data-system-under-test="synthetic-browser-harness">
      <h1>Driver Browser Test-Harness</h1>
      <p>Nur synthetische UI; keine Produktions-App und kein Business-Writer.</p>
      <section data-testid="offer">
        <h2>Neue synthetische Lieferung</h2>
        <button data-testid="accept">Auftrag annehmen</button>
      </section>
      <section data-testid="pickup" hidden>
        <h2>Abholung</h2>
        <label><input data-testid="pick-0" type="checkbox"> Pizza aufgenommen</label>
        <label><input data-testid="pick-1" type="checkbox"> Getränk aufgenommen</label>
        <button data-testid="navigate" disabled>Route starten</button>
      </section>
      <section data-testid="tour" hidden>
        <h2>Unterwegs</h2>
        <button data-testid="arrive">Am Ziel angekommen</button>
        <button data-testid="deliver" hidden>Bestellung übergeben</button>
      </section>
      <p data-testid="status" aria-live="polite">angeboten</p>
    </main>
    <script>
      const byId = (id) => document.querySelector('[data-testid="' + id + '"]');
      const setStatus = (value) => { byId('status').textContent = value; };
      byId('accept').addEventListener('click', () => {
        byId('offer').hidden = true;
        byId('pickup').hidden = false;
        setStatus('angenommen');
      });
      const updatePickup = () => {
        byId('navigate').disabled = !(byId('pick-0').checked && byId('pick-1').checked);
      };
      byId('pick-0').addEventListener('change', updatePickup);
      byId('pick-1').addEventListener('change', updatePickup);
      byId('navigate').addEventListener('click', () => {
        byId('pickup').hidden = true;
        byId('tour').hidden = false;
        setStatus('unterwegs');
      });
      byId('arrive').addEventListener('click', () => {
        byId('arrive').hidden = true;
        byId('deliver').hidden = false;
        setStatus('angekommen');
      });
      byId('deliver').addEventListener('click', () => {
        byId('deliver').hidden = true;
        setStatus('zugestellt');
      });
    </script>
  </body>
</html>`
