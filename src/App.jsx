import { profile, emails, phone, socials, services, skills, projects, faqs } from './master.js'
import { Icon } from './icons.jsx'

const cleanUrl = (url) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <a href="#" aria-label={profile.handle}>
            <img
              src={profile.logo}
              alt={profile.handle}
              className="h-10 w-auto transition duration-300 hover:scale-110"
              style={{
                imageRendering: 'pixelated',
                filter:
                  'drop-shadow(0 0 1px rgba(255,255,255,0.6)) drop-shadow(0 0 8px rgba(52,211,153,0.45))',
              }}
            />
          </a>
          <div className="flex gap-6 text-sm text-zinc-400">
            <a href="#services" className="hover:text-zinc-100">Services</a>
            <a href="#about" className="hover:text-zinc-100">About</a>
            <a href="#projects" className="hover:text-zinc-100">Projects</a>
            <a href="#contact" className="hover:text-zinc-100">Contact</a>
            {profile.cv && (
              <a
                href={profile.cv}
                download
                className="hidden items-center gap-1.5 text-emerald-400 hover:text-emerald-300 sm:inline-flex"
              >
                <Icon name="download" className="h-4 w-4" />
                CV
              </a>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6">
        {/* Hero */}
        <section className="py-24 sm:py-32">
          <p className="mb-4 font-mono text-sm text-emerald-400">Hi, my name is</p>
          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">{profile.name}.</h1>
          <h2 className="mt-3 text-3xl font-semibold text-zinc-500 sm:text-5xl">
            {profile.tagline}
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">{profile.intro}</p>
          {profile.location && (
            <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-zinc-500">
              <Icon name="map-pin" className="h-4 w-4 text-emerald-400" />
              {profile.location}
            </p>
          )}
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#projects"
              className="rounded-lg bg-emerald-400 px-6 py-3 font-medium text-zinc-950 transition hover:bg-emerald-300"
            >
              See my work
            </a>
            <a
              href="#contact"
              className="rounded-lg border border-zinc-700 px-6 py-3 font-medium transition hover:border-zinc-400"
            >
              Get in touch
            </a>
            {profile.cv && (
              <a
                href={profile.cv}
                download
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-6 py-3 font-medium transition hover:border-emerald-400 hover:text-emerald-400"
              >
                <Icon name="download" className="h-5 w-5" />
                Download CV
              </a>
            )}
          </div>
        </section>

        {/* Services */}
        <section id="services" className="scroll-mt-20 py-16">
          <h3 className="text-2xl font-bold">What I build</h3>
          <p className="mb-6 mt-2 text-sm text-zinc-400">{profile.servicesIntro}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <a
                key={s.title}
                href={s.page ? `/services/${s.page}/` : undefined}
                className="block rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 transition hover:border-emerald-400/50"
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex rounded-md bg-emerald-400/10 p-1.5 text-emerald-400">
                    <Icon name={s.icon} className="h-4 w-4" />
                  </span>
                  <h4 className="text-sm font-semibold">{s.title}</h4>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{s.description}</p>
              </a>
            ))}
          </div>
          <a
            href="/services/"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300"
          >
            All services in Mangalore &amp; India
            <Icon name="arrow-up-right" className="h-4 w-4" />
          </a>
        </section>

        {/* About */}
        <section id="about" className="scroll-mt-20 py-16">
          <h3 className="mb-6 text-2xl font-bold">About me</h3>
          <p className="max-w-2xl leading-relaxed text-zinc-400">{profile.about}</p>
          <div className="mt-8 space-y-5">
            {skills.map((group) => (
              <div key={group.category} className="sm:flex sm:gap-6">
                <h4 className="mb-2 shrink-0 font-mono text-xs uppercase tracking-wider text-emerald-400 sm:mb-0 sm:w-44 sm:pt-2">
                  {group.category}
                </h4>
                <ul className="flex flex-wrap gap-2">
                  {group.items.map((skill) => (
                    <li
                      key={skill}
                      className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-sm text-zinc-300"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Projects */}
        <section id="projects" className="scroll-mt-20 py-16">
          <h3 className="mb-8 text-2xl font-bold">Projects</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            {projects.map((p) => (
              <article
                key={p.title}
                className={`flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 transition hover:border-emerald-400/50 ${
                  p.featured ? 'sm:col-span-2' : ''
                }`}
              >
                {p.icon && (
                  <img
                    src={p.icon}
                    alt={`${p.title} icon`}
                    className="mb-4 h-14 w-14 rounded-2xl"
                  />
                )}
                <div className="flex items-baseline justify-between gap-4">
                  <h4 className="text-lg font-semibold">
                    {p.link ? (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 hover:text-emerald-400"
                      >
                        {p.title}
                        <Icon name="arrow-up-right" className="h-4 w-4" />
                      </a>
                    ) : (
                      p.title
                    )}
                  </h4>
                  {p.featured && (
                    <span className="rounded-full bg-emerald-400/10 px-3 py-1 font-mono text-xs text-emerald-400">
                      featured
                    </span>
                  )}
                </div>
                {p.link && <p className="mt-1 font-mono text-xs text-zinc-500">{cleanUrl(p.link)}</p>}
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{p.description}</p>

                {p.links && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {p.links.map((l) => (
                      <a
                        key={l.label}
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-emerald-400 hover:text-emerald-400"
                      >
                        {l.label}
                        <Icon name="arrow-up-right" className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                )}

                {p.note && <p className="mt-4 text-xs leading-relaxed text-zinc-500">{p.note}</p>}

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {p.tags.map((t) => (
                    <span key={t} className="font-mono text-xs text-zinc-500">
                      #{t}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-16">
          <h3 className="mb-6 text-2xl font-bold">FAQ</h3>
          <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {faqs.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-zinc-500 transition group-open:rotate-45" aria-hidden="true">
                    <Icon name="plus" className="h-4 w-4" />
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="scroll-mt-20 py-24 text-center">
          <h3 className="text-3xl font-bold">Let's connect</h3>
          <p className="mx-auto mt-4 max-w-md text-zinc-400">
            Have a project in mind or just want to say hi? My inbox is always open.
          </p>

          <a
            href={`mailto:${emails.primary}`}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-6 py-3 font-medium text-zinc-950 transition hover:bg-emerald-300"
          >
            <Icon name="mail" className="h-5 w-5" />
            {emails.primary}
          </a>

          {emails.alternates.length > 0 && (
            <p className="mt-4 text-sm text-zinc-500">
              Also reachable at{' '}
              {emails.alternates.map((e, i) => (
                <span key={e}>
                  {i > 0 && ' · '}
                  <a href={`mailto:${e}`} className="text-zinc-400 hover:text-emerald-400">
                    {e}
                  </a>
                </span>
              ))}
            </p>
          )}

          {phone && (
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="mt-4 inline-flex items-center gap-2 text-zinc-300 transition hover:text-emerald-400"
            >
              <Icon name="phone" className="h-4 w-4" />
              {phone}
            </a>
          )}

          {profile.location && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-zinc-500">
              <Icon name="map-pin" className="h-4 w-4" />
              {profile.location}
            </p>
          )}

          <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3">
            {socials.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                aria-label={l.label}
                title={l.label}
                className="inline-flex items-center gap-2 text-zinc-400 transition hover:text-emerald-400"
              >
                <Icon name={l.icon} className="h-5 w-5" />
                <span className="text-sm">{l.label}</span>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
