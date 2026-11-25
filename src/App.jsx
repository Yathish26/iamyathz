import { profile, skills, projects, links } from './master.js'

function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <a href="#" className="text-lg font-bold tracking-tight">
            {profile.handle}<span className="text-emerald-400">.</span>
          </a>
          <div className="flex gap-6 text-sm text-zinc-400">
            <a href="#about" className="hover:text-zinc-100">About</a>
            <a href="#projects" className="hover:text-zinc-100">Projects</a>
            <a href="#contact" className="hover:text-zinc-100">Contact</a>
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
          </div>
        </section>

        {/* About */}
        <section id="about" className="scroll-mt-20 py-16">
          <h3 className="mb-6 text-2xl font-bold">About me</h3>
          <p className="max-w-2xl leading-relaxed text-zinc-400">{profile.about}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <li
                key={skill}
                className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-sm text-zinc-300"
              >
                {skill}
              </li>
            ))}
          </ul>
        </section>

        {/* Projects */}
        <section id="projects" className="scroll-mt-20 py-16">
          <h3 className="mb-8 text-2xl font-bold">Projects</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            {projects.map((p) => (
              <a
                key={p.title}
                href={p.link}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 transition hover:-translate-y-1 hover:border-emerald-400/50"
              >
                <h4 className="text-lg font-semibold group-hover:text-emerald-400">{p.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{p.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <span key={t} className="font-mono text-xs text-zinc-500">
                      #{t}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="scroll-mt-20 py-24 text-center">
          <h3 className="text-3xl font-bold">Let's connect</h3>
          <p className="mx-auto mt-4 max-w-md text-zinc-400">
            Have a project in mind or just want to say hi? My inbox is always open.
          </p>
          <div className="mt-8 flex justify-center gap-6">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 underline-offset-4 transition hover:text-emerald-400 hover:underline"
              >
                {l.label}
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800/60 py-8 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} {profile.name}. Built with React &amp; Tailwind CSS.
      </footer>
    </div>
  )
}

export default App
