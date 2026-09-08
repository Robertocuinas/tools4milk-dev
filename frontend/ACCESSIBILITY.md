# Base UI accesible — Release 1

La interfaz usa componentes reutilizables en `src/components/ui`:

- `Button`: variantes semánticas, estado de carga (`aria-busy`), foco visible y objetivos táctiles de al menos 44 px.
- `Badge`: estados con texto persistente; el color no es el único indicador.
- `Input`: etiqueta asociada, descripción, estado inválido y mensaje de error anunciado.
- `StatusState`: carga, vacío, error y éxito con icono y texto.
- `SyntheticMarker`: identifica de forma persistente los datos de demo sintética.

## Responsive y TV

- La navegación lateral ocupa 64 px en móvil y recupera sus etiquetas desde `md`; cada enlace conserva un nombre accesible.
- Los paneles usan grids fluidos y wrapping para evitar overflow horizontal en móvil y tablet.
- La ruta `/tv` es de solo lectura: actualiza datos mediante consultas, sin mutaciones ni controles de escritura.
- En TV se muestra el origen sintético y el estado de actualización de datos.

## Límites

Esta base mejora teclado, foco, nombres accesibles, contraste semántico y preferencias de movimiento reducido, pero no constituye una certificación WCAG completa. La validación final debe incluir revisión manual con lector de pantalla, contraste sobre todas las combinaciones dinámicas y pruebas en navegadores objetivo.
