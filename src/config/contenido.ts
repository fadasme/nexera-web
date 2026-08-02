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
}

export const SERVICIOS_TABS: readonly ServicioTab[] = [
  {
    num: '01',
    title: 'Inteligencia Artificial aplicada',
    desc: 'Ayudamos a identificar oportunidades concretas para usar IA dentro de la empresa, con iniciativas viables, seguras y alineadas al negocio.',
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
    chips: ['Gerencias y líderes', 'Equipos de trabajo', 'Equipos tecnológicos', 'Talleres personalizados'],
  },
  {
    num: '03',
    title: 'Automatización de procesos',
    desc: 'Analizamos procesos manuales y diseñamos automatizaciones proporcionales a las necesidades de cada empresa.',
    chips: ['Levantamiento de procesos', 'Automatización documental', 'Integraciones y APIs', 'Flujos de aprobación'],
  },
  {
    num: '04',
    title: 'Consultoría y modernización tecnológica',
    desc: 'Acompañamos decisiones tecnológicas con mirada experta, priorizando lo que genera más valor y mejor ajuste al negocio.',
    chips: ['Estrategia', 'Ejecución', 'Medición'],
  },
  {
    num: '05',
    title: 'Calidad de software y DevOps',
    desc: 'Aplicamos experiencia en calidad, automatización y DevOps para mejorar estabilidad, trazabilidad y capacidad de evolución.',
    chips: ['Estabilidad', 'Trazabilidad', 'Capacidad de evolución'],
  },
];
