/**
 * Contenido de la landing — copiado VERBATIM del script del mockup
 * (`_design/Nexera Landing.dc.html`). No editar sin actualizar el diseño.
 */

export interface Paso {
  num: string;
  title: string;
  desc: string;
}

export const PASOS: readonly Paso[] = [
  {
    num: '01',
    title: 'Entendemos',
    desc: 'Conversamos sobre la realidad, los problemas y los objetivos de la empresa.',
  },
  {
    num: '02',
    title: 'Priorizamos',
    desc: 'Definimos qué iniciativas generan más valor y cuáles conviene dejar para después.',
  },
  {
    num: '03',
    title: 'Diseñamos e implementamos',
    desc: 'Construimos, configuramos o integramos una solución proporcional al desafío.',
  },
  {
    num: '04',
    title: 'Acompañamos',
    desc: 'Revisamos resultados, capacitamos y definimos los siguientes pasos.',
  },
  {
    num: '05',
    title: 'Evolucionamos',
    desc: 'Desplegamos mejoras cuando el negocio y la madurez lo permiten.',
  },
];

export interface ServicioTab {
  num: string;
  title: string;
  desc: string;
  chips: readonly string[];
  posiblesEntregables: readonly string[];
}

export const SERVICIOS_TABS: readonly ServicioTab[] = [
  {
    num: '01',
    title: 'Inteligencia Artificial aplicada',
    desc: 'Ayudamos a identificar oportunidades concretas para usar IA dentro de la empresa, con iniciativas viables, seguras y alineadas al negocio.',
    posiblesEntregables: [
      'Oportunidades priorizadas por valor, esfuerzo y riesgo',
      'Definición de un caso de uso y sus criterios de evaluación',
      'Diseño de un piloto acotado, si resulta viable',
    ],
    chips: [
      'Diagnóstico de oportunidades de IA',
      'Asistentes internos y agentes de IA',
      'Gestión del conocimiento y RAG',
      'Pilotos controlados',
      'Gobierno y uso responsable',
    ],
  },
  {
    num: '02',
    title: 'Capacitación en Inteligencia Artificial',
    desc: 'Preparamos a gerencias, jefaturas y equipos para comprender y usar IA de forma práctica, segura y responsable.',
    posiblesEntregables: [
      'Sesión ajustada al rol y nivel de experiencia del equipo',
      'Ejercicios prácticos basados en tareas de trabajo',
      'Recomendaciones para un uso responsable de IA',
    ],
    chips: ['Gerencias y líderes', 'Equipos de trabajo', 'Equipos tecnológicos', 'Talleres personalizados'],
  },
  {
    num: '03',
    title: 'Automatización de procesos',
    desc: 'Analizamos procesos manuales y diseñamos automatizaciones proporcionales a las necesidades de cada empresa.',
    posiblesEntregables: [
      'Mapa del proceso actual y sus excepciones',
      'Diseño del flujo objetivo e integraciones necesarias',
      'Pruebas y criterios de validación acordados',
    ],
    chips: ['Levantamiento de procesos', 'Automatización documental', 'Integraciones y APIs', 'Flujos de aprobación'],
  },
  {
    num: '04',
    title: 'Consultoría y modernización tecnológica',
    desc: 'Acompañamos decisiones tecnológicas con mirada experta, priorizando lo que genera más valor y mejor ajuste al negocio.',
    posiblesEntregables: [
      'Diagnóstico de sistemas, restricciones y objetivos',
      'Alternativas técnicas con sus ventajas y riesgos',
      'Hoja de ruta priorizada para tomar decisiones',
    ],
    chips: ['Estrategia', 'Ejecución', 'Medición'],
  },
  {
    num: '05',
    title: 'Calidad de software y DevOps',
    desc: 'Aplicamos experiencia en calidad, automatización y DevOps para mejorar estabilidad, trazabilidad y capacidad de evolución.',
    posiblesEntregables: [
      'Revisión de prácticas de prueba y despliegue',
      'Brechas priorizadas según impacto y riesgo',
      'Plan de mejora gradual para calidad y entrega',
    ],
    chips: ['Estabilidad', 'Trazabilidad', 'Capacidad de evolución'],
  },
];
