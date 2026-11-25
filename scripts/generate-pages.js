// Generates one static SEO page per service into services/<slug>/index.html,
// a services index at services/index.html, and public/sitemap.xml.
// Runs automatically before `npm run dev` and `npm run build`.
// Content comes from src/servicePages.js and src/master.js — edit those, not the output.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { servicePages } from '../src/servicePages.js'
import { profile, emails, phone, socials, projects } from '../src/master.js'

const SITE = 'https://iamyathz.dev'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'services')
const today = new Date().toISOString().slice(0, 10)
const tel = phone.replace(/\s/g, '')

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const svg = (inner, cls = 'h-5 w-5') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${inner}</svg>`
const icons = {
  mail: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
  phone: svg('<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>'),
  pin: svg('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 'h-4 w-4 text-emerald-400'),
  check: svg('<path d="M20 6 9 17l-5-5"/>', 'h-4 w-4'),
  arrow: svg('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>', 'h-4 w-4'),
  back: svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', 'h-4 w-4'),
}

const personRef = { '@type': 'Person', '@id': `${SITE}/#person`, name: profile.name, url: `${SITE}/` }

const head = ({ title, description, url, jsonld }) => `<!doctype html>
<html lang="en-IN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="author" content="${esc(profile.name)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${url}" />
    <meta name="theme-color" content="#09090b" />
    <meta name="geo.region" content="IN-KA" />
    <meta name="geo.placename" content="Mangaluru, Karnataka, India" />
    <link rel="icon" type="image/png" href="/logo.png" />
    <link rel="apple-touch-icon" href="/logo.png" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="iamyathz" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE}/logo.png" />
    <meta property="og:locale" content="en_IN" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:site" content="@iamyathz" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${SITE}/logo.png" />
    <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
    <script type="module" src="/src/page.js"></script>
  </head>
  <body class="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
    <header class="sticky top-0 z-10 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur">
      <nav class="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <a href="/" aria-label="${esc(profile.name)} – home">
          <img src="/logo.png" alt="${esc(profile.handle)}" class="h-10 w-auto" style="image-rendering: pixelated; filter: drop-shadow(0 0 1px rgba(255,255,255,0.6)) drop-shadow(0 0 8px rgba(52,211,153,0.45))" />
        </a>
        <div class="flex gap-6 text-sm text-zinc-400">
          <a href="/services/" class="hover:text-zinc-100">Services</a>
          <a href="/#projects" class="hover:text-zinc-100">Projects</a>
          <a href="#contact" class="hover:text-zinc-100">Contact</a>
        </div>
      </nav>
    </header>
    <main class="mx-auto max-w-4xl px-6">`

const contactBlock = (heading) => `
      <section id="contact" class="scroll-mt-20 py-16">
        <div class="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-8 text-center">
          <h2 class="text-2xl font-bold">${esc(heading)}</h2>
          <p class="mx-auto mt-3 max-w-lg text-zinc-400">Tell me what you need. I reply quickly and can meet in person in Mangalore or Bengaluru, or work fully online.</p>
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            <a href="mailto:${emails.primary}" class="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 font-medium text-zinc-950 transition hover:bg-emerald-300">${icons.mail}${esc(emails.primary)}</a>
            <a href="tel:${tel}" class="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-5 py-3 font-medium transition hover:border-emerald-400 hover:text-emerald-400">${icons.phone}${esc(phone)}</a>
          </div>
          <p class="mt-5 inline-flex items-center gap-1.5 text-sm text-zinc-500">${icons.pin}${esc(profile.location)}</p>
        </div>
      </section>`

const foot = () => `
    </main>
    <footer class="border-t border-zinc-800/60 py-8">
      <div class="mx-auto max-w-4xl px-6 text-sm text-zinc-500">
        <p class="mb-3 font-medium text-zinc-400">Developer services in Mangalore, Karnataka &amp; India</p>
        <ul class="flex flex-wrap gap-x-5 gap-y-2">
          ${servicePages.map((p) => `<li><a href="/services/${p.slug}/" class="hover:text-emerald-400">${esc(p.name)}</a></li>`).join('\n          ')}
        </ul>
        <p class="mt-4 flex flex-wrap gap-x-4 gap-y-1">
          <a href="/" class="hover:text-emerald-400">${esc(profile.name)}</a>
          ${socials.map((s) => `<a href="${s.href}" target="_blank" rel="noreferrer" class="hover:text-emerald-400">${esc(s.label)}</a>`).join('\n          ')}
        </p>
      </div>
    </footer>
  </body>
</html>
`

function servicePage(p) {
  const url = `${SITE}/services/${p.slug}/`
  const related = p.projects.map((t) => projects.find((x) => x.title === t)).filter(Boolean)
  const others = servicePages.filter((o) => o.slug !== p.slug)

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: `${p.name} in Mangalore`,
        serviceType: p.name,
        description: p.description,
        url,
        provider: personRef,
        areaServed: [
          { '@type': 'City', name: 'Mangaluru' },
          { '@type': 'City', name: 'Bengaluru' },
          { '@type': 'State', name: 'Karnataka' },
          { '@type': 'Country', name: 'India' },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE}/services/` },
          { '@type': 'ListItem', position: 3, name: p.name, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: p.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }

  return `${head({ title: p.title, description: p.description, url, jsonld })}
      <nav aria-label="Breadcrumb" class="pt-10 text-sm text-zinc-500">
        <a href="/" class="hover:text-zinc-300">Home</a> / <a href="/services/" class="hover:text-zinc-300">Services</a> / <span class="text-zinc-400">${esc(p.name)}</span>
      </nav>

      <section class="py-12">
        <p class="mb-4 inline-flex items-center gap-1.5 font-mono text-sm text-emerald-400">${icons.pin}Mangalore (Mangaluru), Karnataka, India</p>
        <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">${esc(p.h1)}</h1>
        <p class="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">${esc(p.lead)}</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a href="#contact" class="rounded-lg bg-emerald-400 px-6 py-3 font-medium text-zinc-950 transition hover:bg-emerald-300">Get a free quote</a>
          <a href="/#projects" class="rounded-lg border border-zinc-700 px-6 py-3 font-medium transition hover:border-zinc-400">See my work</a>
        </div>
      </section>

      <section class="py-10">
        <h2 class="mb-6 text-2xl font-bold">What I offer</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          ${p.offerings
            .map(
              (o) => `<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
            <h3 class="flex items-center gap-2 text-sm font-semibold"><span class="text-emerald-400">${icons.check}</span>${esc(o.t)}</h3>
            <p class="mt-1.5 text-xs leading-relaxed text-zinc-400">${esc(o.d)}</p>
          </div>`,
            )
            .join('\n          ')}
        </div>
      </section>

      <section class="py-10">
        <h2 class="mb-4 text-2xl font-bold">Why work with me</h2>
        <ul class="space-y-3 text-zinc-400">
          <li class="flex gap-3"><span class="mt-1 text-emerald-400">${icons.check}</span><span><strong class="text-zinc-200">Real products in production.</strong> I built the Grojet delivery platform end to end: customer, merchant and rider apps, admin panel, live tracking, payments and automatic rider assignment.</span></li>
          <li class="flex gap-3"><span class="mt-1 text-emerald-400">${icons.check}</span><span><strong class="text-zinc-200">Local and reachable.</strong> Based in Mangalore (Mangaluru) and also working from Bengaluru, so we can meet in person or work fully online.</span></li>
          <li class="flex gap-3"><span class="mt-1 text-emerald-400">${icons.check}</span><span><strong class="text-zinc-200">Full stack, one person.</strong> Design, frontend, backend, database, deployment and launch, without passing your project between teams.</span></li>
          <li class="flex gap-3"><span class="mt-1 text-emerald-400">${icons.check}</span><span><strong class="text-zinc-200">Clients anywhere.</strong> Mangalore, Udupi, Bengaluru, the rest of Karnataka, across India and worldwide.</span></li>
        </ul>
      </section>

      <section class="py-10">
        <h2 class="mb-4 text-2xl font-bold">How it works</h2>
        <ol class="grid gap-3 sm:grid-cols-4">
          ${['Tell me what you need', 'Get a clear plan & quote', 'I build it, with regular updates', 'Launch & ongoing support']
            .map(
              (s, i) => `<li class="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm"><span class="font-mono text-emerald-400">0${i + 1}</span><p class="mt-1 text-zinc-300">${s}</p></li>`,
            )
            .join('\n          ')}
        </ol>
      </section>

      <section class="py-10">
        <h2 class="mb-4 text-2xl font-bold">Technologies</h2>
        <ul class="flex flex-wrap gap-2">
          ${p.tech.map((t) => `<li class="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-sm text-zinc-300">${esc(t)}</li>`).join('\n          ')}
        </ul>
      </section>
${
  related.length
    ? `
      <section class="py-10">
        <h2 class="mb-4 text-2xl font-bold">Related projects</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          ${related
            .map(
              (r) => `<div class="flex gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            ${r.icon ? `<img src="${r.icon}" alt="${esc(r.title)} icon" class="h-12 w-12 shrink-0 rounded-xl" loading="lazy" />` : ''}
            <div>
              <h3 class="font-semibold">${r.link ? `<a href="${r.link}" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 hover:text-emerald-400">${esc(r.title)}${icons.arrow}</a>` : esc(r.title)}</h3>
              <p class="mt-1 text-xs leading-relaxed text-zinc-400">${esc(r.description)}</p>
            </div>
          </div>`,
            )
            .join('\n          ')}
        </div>
      </section>
`
    : ''
}
      <section class="py-10">
        <h2 class="mb-4 text-2xl font-bold">Frequently asked questions</h2>
        <div class="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          ${p.faqs
            .map(
              (f) => `<div class="px-5 py-4">
            <h3 class="font-medium">${esc(f.q)}</h3>
            <p class="mt-2 text-sm leading-relaxed text-zinc-400">${esc(f.a)}</p>
          </div>`,
            )
            .join('\n          ')}
        </div>
      </section>
${contactBlock(`Need ${p.name.toLowerCase()} in Mangalore or anywhere in India?`)}

      <section class="pb-16">
        <h2 class="mb-4 text-lg font-semibold">Other services</h2>
        <div class="flex flex-wrap gap-2">
          ${others.map((o) => `<a href="/services/${o.slug}/" class="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-emerald-400 hover:text-emerald-400">${esc(o.name)}</a>`).join('\n          ')}
        </div>
      </section>
${foot()}`
}

function servicesIndex() {
  const url = `${SITE}/services/`
  const title = 'Developer Services in Mangalore, Karnataka & India | Yathish Acharya'
  const description =
    'Website development, Android & iOS apps, Telegram bots, automation, web scraping, AI agents and data analysis by Yathish Acharya, a full stack developer in Mangalore (Mangaluru), Karnataka, India.'
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Developer services in Mangalore',
    itemListElement: servicePages.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      url: `${SITE}/services/${p.slug}/`,
    })),
  }
  return `${head({ title, description, url, jsonld })}
      <section class="py-16">
        <p class="mb-4 inline-flex items-center gap-1.5 font-mono text-sm text-emerald-400">${icons.pin}Mangalore (Mangaluru), Karnataka, India</p>
        <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">Developer Services in Mangalore</h1>
        <p class="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">I'm ${esc(profile.name)}, a full stack developer in Mangalore (Mangaluru) and Bengaluru. I build websites, mobile apps, bots, automations, AI agents and data tools for businesses in Mangalore, across Karnataka and India, and worldwide.</p>
      </section>
      <section class="grid gap-4 pb-6 sm:grid-cols-2">
        ${servicePages
          .map(
            (p) => `<a href="/services/${p.slug}/" class="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-emerald-400/50">
          <h2 class="flex items-center justify-between font-semibold group-hover:text-emerald-400">${esc(p.h1)}${icons.arrow}</h2>
          <p class="mt-2 text-sm leading-relaxed text-zinc-400">${esc(p.description)}</p>
        </a>`,
          )
          .join('\n        ')}
      </section>
${contactBlock('Have a project in mind?')}
${foot()}`
}

function sitemap() {
  const urls = [
    { loc: `${SITE}/`, priority: '1.0' },
    { loc: `${SITE}/services/`, priority: '0.9' },
    ...servicePages.map((p) => ({ loc: `${SITE}/services/${p.slug}/`, priority: '0.9' })),
    { loc: `${SITE}/Yathish_CV.pdf`, priority: '0.5' },
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`
}

// --- write everything ---
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'index.html'), servicesIndex())
for (const p of servicePages) {
  fs.mkdirSync(path.join(outDir, p.slug), { recursive: true })
  fs.writeFileSync(path.join(outDir, p.slug, 'index.html'), servicePage(p))
}
fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), sitemap())
console.log(`Generated ${servicePages.length} service pages + services index + sitemap.xml`)
