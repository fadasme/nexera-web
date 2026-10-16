import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('cada servicio explica posibles entregables sin prometer un alcance fijo', async () => {
  const [content, component] = await Promise.all([
    source('src/config/contenido.ts'),
    source('src/components/Servicios.astro'),
  ]);

  assert.equal((content.match(/posiblesEntregables:/g) ?? []).length, 6, 'Debe estar el tipo y los cinco servicios');
  assert.match(component, /Qué podríamos definir o entregar/);
  assert.match(component, /El alcance depende del contexto y se acuerda antes de iniciar/);
  assert.match(component, /data-track-event=\{`cta_servicio_\$\{s\.num\}`\}/);
  assert.match(component, /data-contact-service=\{servicioFormulario\[i\]\}/);
});

test('los CTA y el formulario aclaran el siguiente paso y miden intención sin recopilar datos en eventos', async () => {
  const [hero, contact, form, tracking] = await Promise.all([
    source('src/components/Hero.astro'),
    source('src/components/Contacto.astro'),
    source('src/components/ContactForm.astro'),
    source('src/scripts/enhance.ts'),
  ]);

  assert.match(hero, /Cuéntanos tu desafío/);
  assert.match(contact, /La conversación inicial sirve para entender el contexto/);
  assert.match(contact, /data-track-event="click_whatsapp_contacto"/);
  assert.match(form, /Tamaño aproximado de la empresa <span class="optional">Opcional<\/span>/);
  assert.match(form, /No incluyas contraseñas, datos sensibles ni información confidencial/);
  assert.match(tracking, /closest<HTMLElement>\('\[data-track-event\]'\)/);
  assert.match(tracking, /input\.value === service/);
  assert.doesNotMatch(tracking, /email|telefono|mensaje/);
});

test('el proyecto ecommerce describe solo el flujo observable y no atribuye resultados comerciales', async () => {
  const [page, project] = await Promise.all([
    source('src/pages/index.astro'),
    source('src/components/ProyectoPerfumeria.astro'),
  ]);

  assert.match(page, /<ProyectoPerfumeria \/>/);
  assert.match(project, /explorar productos, marcas y categorías/);
  assert.match(project, /Carrito y pedido por WhatsApp/);
  assert.match(project, /El pago y el despacho se coordinan directamente/);
  assert.doesNotMatch(project, /aumentó las ventas|más conversiones|pago online activo/i);
  assert.doesNotMatch(project, /marceloperfumeria\.cl|Marcelo Perfumería/i);
});
