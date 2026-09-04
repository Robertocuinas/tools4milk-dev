# TFM-Roberto
Tools4 Milk
Tools4 Milk es una plataforma digital de apoyo a la toma de decisiones para explotaciones lecheras. El proyecto nace en el marco del Trabajo Final de Master "Arquitectura inteligente de datos y modelos predictivos para la produccion de leche a la carta", orientado a mejorar la gestion productiva, sanitaria, alimentaria y operativa de una granja lechera mediante el uso integrado de datos.

La aplicacion se plantea como una herramienta practica para transformar la informacion dispersa de la explotacion en indicadores comprensibles, alertas utiles y recomendaciones accionables para el personal ganadero.

Contexto
El sector lacteo europeo y gallego se encuentra en un momento de transformacion. Las explotaciones afrontan presiones economicas, ambientales, regulatorias, laborales y de mercado que obligan a producir de forma mas eficiente, sostenible y diferenciada.

Galicia ocupa una posicion estrategica dentro del sector lacteo espanol y europeo, pero su modelo productivo esta evolucionando hacia menos explotaciones, de mayor tamano y con una mayor necesidad de gestion basada en datos. En este escenario, herramientas como Tools4 Milk buscan ayudar a que las granjas puedan aprovechar mejor la informacion que ya generan en su actividad diaria.

Problema que aborda
Las explotaciones lecheras tecnificadas producen una gran cantidad de datos: robots de ordeno, collares de actividad, sensores ambientales, registros de alimentacion, datos sanitarios, controles de calidad de leche y anotaciones operativas del dia a dia.

Sin embargo, gran parte de esa informacion permanece fragmentada en sistemas separados, hojas de calculo, aplicaciones no conectadas o pizarras fisicas. Esta dispersion dificulta detectar problemas a tiempo, interpretar tendencias, coordinar al equipo y tomar decisiones con una vision completa de la explotacion.

Tools4 Milk parte de esa necesidad: reunir la informacion relevante en una plataforma unica y convertirla en conocimiento util para la gestion diaria.

Propuesta del proyecto
La plataforma propone un sistema DSS orientado a explotaciones lecheras de tamano medio-alto. Su objetivo no es sustituir el criterio del ganadero, sino reforzarlo con informacion integrada, actualizada y presentada de forma clara.

Tools4 Milk se organiza en torno a cinco grandes areas funcionales:

Produccion: seguimiento de la produccion de leche, tendencias por animal o grupo, desviaciones y predicciones de rendimiento.
Calidad de leche: analisis de indicadores composicionales, alertas de calidad y apoyo al concepto de leche a la carta.
Alimentacion: control de raciones, desviaciones en mezclas, consumo de insumos y relacion entre dieta y resultados productivos.
Salud y reproduccion: seguimiento de animales, tratamientos, recria, eventos sanitarios y alertas relevantes para la toma de decisiones.
LeanFarming: digitalizacion de tareas, incidencias, turnos, pedidos y pantallas visuales por zona para mejorar la organizacion operativa.
Leche a la carta
Uno de los ejes diferenciales del proyecto es el concepto de leche a la carta. La idea consiste en relacionar la alimentacion de los animales con la calidad composicional de la leche, especialmente con su perfil lipidico.

El objetivo es que la explotacion pueda anticipar como determinados cambios en la racion pueden influir en el producto final. Esto abre la puerta a una leche con caracteristicas nutricionales mas especificas, verificables y adaptadas a oportunidades de mercado de mayor valor anadido.

LeanFarming
Tools4 Milk incorpora el enfoque Lean aplicado al contexto ganadero. El punto de partida son las pizarras fisicas que muchas explotaciones utilizan para coordinar tareas, incidencias, tratamientos, pedidos y relevos de turno.

El modulo LeanFarming traslada esa gestion visual al entorno digital, manteniendo su sencillez operativa pero anadiendo actualizacion automatica, trazabilidad y priorizacion de alertas. La informacion se adapta a cada zona de la granja para que cada persona vea lo que necesita en el momento y lugar adecuados.

Caso de estudio
El proyecto se ha disenado tomando como referencia una explotacion lechera gallega situada en Villalba, Lugo. Se trata de una granja representativa del modelo intensivo de tamano medio-alto, con robots de ordeno, personal organizado en turnos y una gestion diaria apoyada en varias pizarras fisicas distribuidas por la explotacion.

Este caso real permite que el diseno de la aplicacion responda a necesidades concretas del trabajo diario: cambios de turno, seguimiento de animales, control de incidencias, organizacion por zonas, alertas sanitarias, rutinas de alimentacion y toma de decisiones productivas.

Principios de diseno
Tools4 Milk se apoya en varios principios transversales:

Accionabilidad: cada indicador debe ayudar a decidir o actuar, no limitarse a mostrar datos.
Gestion visual: la informacion debe ser clara, jerarquizada y adaptada al contexto de uso.
Integracion: la plataforma busca reunir datos dispersos para evitar decisiones basadas en informacion incompleta.
Trazabilidad: los registros relevantes deben conservar su historial para facilitar seguimiento, auditoria y aprendizaje.
Usabilidad en granja: la interfaz debe ser comprensible para perfiles diversos y util en condiciones reales de trabajo.
Transparencia: las recomendaciones predictivas deben mostrar sus limites y evitar presentarse como verdades absolutas.
Impacto esperado
El impacto de la aplicacion se plantea en cuatro dimensiones:

Productiva: mejorar la eficiencia de la explotacion y anticipar desviaciones en produccion o calidad.
Sanitaria: facilitar la deteccion temprana de problemas y el seguimiento de tratamientos.
Operativa: reducir tiempos improductivos, mejorar la coordinacion del equipo y digitalizar rutinas repetitivas.
Sostenible: apoyar un uso mas eficiente de recursos como alimentacion, energia e insumos, contribuyendo a una produccion mas responsable.
Estado del proyecto
Tools4 Milk es un prototipo academico en desarrollo dentro de un Trabajo Final de Master. El alcance funcional y las decisiones tecnicas pueden evolucionar durante las siguientes fases del proyecto.

Por ese motivo, este README se centra en la vision, el proposito y el valor de la aplicacion. La documentacion tecnica se mantiene separada y podra actualizarse conforme avance la implementacion.

Contexto academico
Este proyecto forma parte del Master en Bioinformatica y Bioestadistica de la UOC y la Universidad de Barcelona, dentro del area de desarrollo de programas y aplicaciones.

El trabajo combina revision bibliografica, analisis de requisitos en una explotacion real, diseno de una arquitectura de datos, desarrollo de un prototipo funcional, modelos predictivos y una interfaz DSS orientada a la toma de decisiones en ganaderia lechera.
2.4.	Selección tecnológica y diseño de la arquitectura
La selección del stack tecnológico se fundamentó en criterios de madurez, comunidad, ecosistema de bibliotecas y adecuación a los requisitos del proyecto. Para el backend se eligió Python con el framework FastAPI, por su soporte nativo de programación asíncrona (ASGI), generación automática de documentación OpenAPI/Swagger y validación de datos integrada mediante Pydantic. Para la base de datos se seleccionó PostgreSQL, por su robustez, soporte de tipos JSONB para datos semi-estructurados y amplia comunidad. Para el frontend se eligió Next.js con React, junto con Zustand para la gestión de estado y TanStack Query para la comunicación con la API. El diseño visual se implementó con TailwindCSS.

El sistema adopta una arquitectura monolítica modular desplegada mediante contenedores Docker. A diferencia de aproximaciones basadas en microservicios, se optó por una única aplicación backend que concentra toda la lógica de negocio, simplificando el despliegue y el mantenimiento en el contexto de un MVP. La comunicación entre frontend y backend se realiza exclusivamente a través de una API REST protegida por tokens JWT. La infraestructura de despliegue se orquesta mediante Docker Compose con cuatro servicios containerizados: base de datos, backend, frontend y proxy inverso.
