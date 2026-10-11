import { SERVICIOS_TABS } from '@/config/contenido';

const root = document.querySelector<HTMLElement>('[data-chatbox]');

if (root) {
  const windowEl = root.querySelector<HTMLElement>('[data-chat-window]');
  const openButton = root.querySelector<HTMLButtonElement>('[data-chat-open]');
  const closeButton = root.querySelector<HTMLButtonElement>('[data-chat-close]');
  const messages = root.querySelector<HTMLElement>('[data-chat-messages]');
  const choices = root.querySelector<HTMLElement>('[data-chat-choices]');
  const form = root.querySelector<HTMLFormElement>('[data-chat-form]');
  const input = root.querySelector<HTMLInputElement>('#chat-message');
  const whatsapp = root.dataset.whatsapp;

  if (windowEl && openButton && closeButton && messages && choices && form && input) {
    type Intent = 'ia' | 'training' | 'automation' | 'consulting' | 'quality' | 'person' | 'unknown';
    type Stage = 'start' | 'goal' | 'context' | 'done';

    let stage: Stage = 'start';
    let selectedIntent: Intent = 'unknown';
    let goal = '';
    let context = '';

    const cloneTemplate = <T extends HTMLElement>(selector: string) =>
      root.querySelector<HTMLElement>(selector)?.firstElementChild?.cloneNode(true) as T;

    const addMessage = (text: string, role: 'assistant' | 'user') => {
      const message = cloneTemplate<HTMLDivElement>('[data-chat-message-template]');
      message.classList.remove('assistant', 'user');
      message.classList.add('message', role);
      message.textContent = text;
      messages.append(message);
      messages.scrollTop = messages.scrollHeight;
    };

    const addLink = (text: string, href: string) => {
      const link = cloneTemplate<HTMLAnchorElement>('[data-chat-link-template]');
      link.href = href;
      link.textContent = text;
      if (href.startsWith('https://')) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      messages.append(link);
      messages.scrollTop = messages.scrollHeight;
    };

    const scrollMessages = () => {
      messages.scrollTop = messages.scrollHeight;
    };

    const setChoices = (items: { label: string; value: string }[]) => {
      const group = cloneTemplate<HTMLDivElement>('[data-chat-choices-template]');
      const buttonTemplate = group.querySelector('button');
      buttonTemplate?.remove();
      for (const item of items) {
        const button = buttonTemplate?.cloneNode(true) as HTMLButtonElement | undefined;
        if (!button) continue;
        button.type = 'button';
        button.dataset.answer = item.value;
        button.textContent = item.label;
        group.append(button);
      }
      messages.append(group);
      scrollMessages();
    };

    const serviceFor = (intent: Intent) => {
      const index = { ia: 0, training: 1, automation: 2, consulting: 3, quality: 4 }[intent as Exclude<Intent, 'person' | 'unknown'>];
      return index === undefined ? undefined : SERVICIOS_TABS[index];
    };

    const recommendations: Partial<Record<Intent, string>> = {
      ia: 'Suele convenir partir por un caso de uso acotado: qué información o tarea está involucrada, quién la utilizará y cómo se medirá si el piloto aporta valor. No siempre hace falta entrenar un modelo propio.',
      training: 'Una capacitación útil parte del trabajo real del equipo, su nivel actual y reglas claras para proteger información. Así el taller termina en prácticas aplicables, no solo en una demostración de herramientas.',
      automation: 'Antes de automatizar, conviene mapear el proceso actual, sus excepciones y sistemas involucrados. Automatizar un flujo que aún cambia mucho puede trasladar el problema sin resolverlo.',
      consulting: 'El primer paso es ordenar objetivos, restricciones y sistemas existentes; luego se priorizan iniciativas por valor, esfuerzo y riesgo, en vez de elegir tecnología por moda.',
      quality: 'La mejora normalmente comienza identificando dónde se producen fallas o retrabajo y cómo se despliega hoy. Con ese mapa se priorizan pruebas, trazabilidad y automatización de entrega.',
    };

    const intentNames: Partial<Record<Intent, string>> = {
      ia: 'Inteligencia Artificial aplicada',
      training: 'Capacitación en Inteligencia Artificial',
      automation: 'Automatización de procesos',
      consulting: 'Consultoría y modernización tecnológica',
      quality: 'Calidad de software y DevOps',
    };

    const showContactOptions = () => {
      const service = intentNames[selectedIntent] ?? 'Orientación inicial';
      const summary = [
        'Hola, llegué desde el sitio de Nexera y quisiera conversar sobre:',
        `Servicio: ${service}`,
        goal && `Objetivo: ${goal}`,
        context && `Contexto: ${context}`,
      ].filter(Boolean).join('\n');

      addMessage('Con esto ya tenemos un punto de partida. Esta orientación es preliminar: el equipo puede validar alcance, factibilidad, riesgos y próximos pasos contigo.', 'assistant');
      addLink('Describir mi caso en el formulario', '#contacto');
      if (whatsapp) {
        addLink('Enviar este resumen por WhatsApp', `https://wa.me/${whatsapp}?text=${encodeURIComponent(summary)}`);
      }
    };

    const finishIntent = () => {
      if (selectedIntent === 'person') {
        stage = 'done';
        addMessage('Perfecto. Puedes escribirnos directamente o dejar tus datos; una persona del equipo revisará tu consulta.', 'assistant');
        addLink('Ir al formulario de contacto', '#contacto');
        if (whatsapp) addLink('Abrir WhatsApp', `https://wa.me/${whatsapp}?text=${encodeURIComponent('Hola, quisiera conversar con el equipo de Nexera.')}`);
        return;
      }

      const service = serviceFor(selectedIntent);
      if (!service) {
        stage = 'start';
        addMessage('No logré asociar eso a un servicio todavía. ¿Qué resultado buscas: reducir trabajo manual, mejorar decisiones, capacitar al equipo o modernizar una solución?', 'assistant');
        setChoices([
          { label: 'Reducir trabajo manual', value: 'goal:Reducir trabajo manual' },
          { label: 'Mejorar decisiones o acceso a información', value: 'goal:Mejorar decisiones o acceso a información' },
          { label: 'Preparar al equipo', value: 'goal:Preparar al equipo' },
          { label: 'Modernizar una solución', value: 'goal:Modernizar una solución' },
        ]);
        return;
      }

      addMessage(`${service.title}\n${service.desc}\n\n${recommendations[selectedIntent] ?? ''}`, 'assistant');
      addMessage('¿En qué etapa están hoy?', 'assistant');
      setChoices([
        { label: 'Explorando opciones', value: 'context:Explorando opciones' },
        { label: 'Ya tenemos un caso definido', value: 'context:Ya tenemos un caso definido' },
        { label: 'Necesitamos implementar pronto', value: 'context:Necesitamos implementar pronto' },
      ]);
      stage = 'context';
    };

    const beginIntent = (intent: Intent, label: string) => {
      selectedIntent = intent;
      addMessage(label, 'user');
      choices.remove();

      if (intent === 'person') {
        finishIntent();
        return;
      }

      const recommendation = recommendations[intent];
      if (!recommendation) {
        finishIntent();
        return;
      }
      const service = serviceFor(intent);
      if (service) addMessage(`${service.title}\n${service.desc}\n\n${recommendation}`, 'assistant');
      addMessage('Entiendo. Para orientarte sin adivinar, ¿qué te gustaría conseguir principalmente?', 'assistant');
      setChoices([
        { label: 'Reducir tareas manuales', value: 'goal:Reducir tareas manuales' },
        { label: 'Encontrar o usar mejor la información', value: 'goal:Encontrar o usar mejor la información' },
        { label: 'Desarrollar capacidades del equipo', value: 'goal:Desarrollar capacidades del equipo' },
        { label: 'Mejorar una solución existente', value: 'goal:Mejorar una solución existente' },
      ]);
      stage = 'goal';
    };

    const normalize = (text: string) => text.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const inferIntent = (text: string): Intent => {
      const value = normalize(text);
      if (/capacit|taller|curso|entren|formacion/.test(value)) return 'training';
      if (/automat|proceso|manual|integraci|flujo|repetitiv/.test(value)) return 'automation';
      if (/calidad|software|devops|prueba|testing|despliegue/.test(value)) return 'quality';
      if (/consultor|moderniz|arquitect|estrateg|sistema/.test(value)) return 'consulting';
      if (/\bia\b|inteligencia artificial|asistente|agente|rag|llm|conocimiento/.test(value)) return 'ia';
      if (/persona|humano|contact|hablar|reuni|whatsapp/.test(value)) return 'person';
      return 'unknown';
    };

    const parseChoice = (value: string, label: string) => {
      if (value === 'restart') {
        addMessage(label, 'user');
        stage = 'start';
        selectedIntent = 'unknown';
        goal = '';
        context = '';
        addMessage('Claro. ¿Qué necesitas resolver?', 'assistant');
        setChoices([
          { label: 'Aplicar IA', value: 'intent:ia' },
          { label: 'Automatizar procesos', value: 'intent:automation' },
          { label: 'Capacitar al equipo', value: 'intent:training' },
          { label: 'Hablar con una persona', value: 'intent:person' },
        ]);
        return;
      }

      const [kind, ...parts] = value.split(':');
      const answer = parts.join(':');
      addMessage(answer, 'user');

      if (kind === 'goal') {
        goal = answer;
        addMessage('Gracias. ¿En qué etapa están hoy?', 'assistant');
        setChoices([
          { label: 'Explorando opciones', value: 'context:Explorando opciones' },
          { label: 'Ya tenemos un caso definido', value: 'context:Ya tenemos un caso definido' },
          { label: 'Necesitamos implementar pronto', value: 'context:Necesitamos implementar pronto' },
        ]);
        stage = 'context';
      } else if (kind === 'context') {
        context = answer;
        stage = 'done';
        showContactOptions();
        setChoices([{ label: 'Empezar otra consulta', value: 'restart' }]);
      }
    };

    const setOpen = (open: boolean) => {
      windowEl.hidden = !open;
      openButton.setAttribute('aria-expanded', String(open));
      root.classList.toggle('is-open', open);
      if (open) input.focus();
      else openButton.focus();
    };

    openButton.addEventListener('click', () => setOpen(windowEl.hasAttribute('hidden')));
    closeButton.addEventListener('click', () => setOpen(false));

    choices.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-intent]');
      if (!button) return;
      beginIntent((button.dataset.intent ?? 'unknown') as Intent, button.textContent?.trim() ?? '');
    });

    messages.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-answer]');
      if (!button) return;
      button.parentElement?.remove();
      const value = button.dataset.answer ?? '';
      if (value.startsWith('intent:')) {
        beginIntent(value.slice('intent:'.length) as Intent, button.textContent?.trim() ?? '');
      } else {
        parseChoice(value, button.textContent?.trim() ?? '');
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addMessage(text, 'user');
      input.value = '';

      if (stage === 'goal') {
        goal = text;
        addMessage('Entendido. ¿En qué etapa están hoy?', 'assistant');
        setChoices([
          { label: 'Explorando opciones', value: 'context:Explorando opciones' },
          { label: 'Ya tenemos un caso definido', value: 'context:Ya tenemos un caso definido' },
          { label: 'Necesitamos implementar pronto', value: 'context:Necesitamos implementar pronto' },
        ]);
        stage = 'context';
        return;
      }

      if (stage === 'context') {
        context = text;
        stage = 'done';
        showContactOptions();
        setChoices([{ label: 'Empezar otra consulta', value: 'restart' }]);
        return;
      }

      const intent = inferIntent(text);
      if (intent === 'unknown') {
        addMessage('Para orientarte mejor, elige el tema más cercano. Si no encaja, puedes escribir tu caso en el formulario y lo revisará el equipo.', 'assistant');
        setChoices([
          { label: 'Aplicar IA', value: 'intent:ia' },
          { label: 'Automatizar procesos', value: 'intent:automation' },
          { label: 'Capacitar al equipo', value: 'intent:training' },
          { label: 'Modernizar tecnología', value: 'intent:consulting' },
          { label: 'Hablar con una persona', value: 'intent:person' },
        ]);
        addLink('Ir al formulario de contacto', '#contacto');
      } else {
        beginIntent(intent, intentNames[intent] ?? 'Hablar con una persona');
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !windowEl.hidden) setOpen(false);
    });
  }
}
