// Franja fija de QA. Solo se renderiza cuando isQa() (ver app/layout.tsx).
// Amarillo de advertencia + texto negro: no se confunde con la paleta de la
// marca (salvia/beige/café).
const BANNER_HEIGHT = '28px'

// Empuja el contenido: el body baja la altura de la franja y los elementos
// fijos pegados arriba (Navbar, barra móvil y sidebar del admin) también,
// para que la franja no tape la navegación. Solo existe en QA porque este
// componente solo se monta en QA. Se excluye el sidebar del dashboard
// (`lg:relative`): en desktop deja de ser fijo y `top` lo desplazaría.
const OFFSET_CSS = `
body { padding-top: ${BANNER_HEIGHT}; }
.fixed.top-0, .fixed.inset-y-0:not(.lg\\:relative) { top: ${BANNER_HEIGHT}; }
`

export function QaBanner() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: OFFSET_CSS }} />
      <div
        role="status"
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center text-sm font-bold tracking-wide"
        style={{ height: BANNER_HEIGHT, backgroundColor: '#FFD400', color: '#111111' }}
      >
        QA — no es el sitio real
      </div>
    </>
  )
}
