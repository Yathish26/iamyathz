// ============================================================
//  master.js — edit everything about your portfolio here.
//  The page (App.jsx) reads all its content from this file.
// ============================================================

export const profile = {
  name: 'Yathish',
  handle: 'yathish', // shown in the top-left logo
  tagline: 'I build things for the web.',
  intro:
    "I'm a developer who enjoys turning ideas into clean, fast, and friendly websites and apps. Welcome to my little corner of the internet.",
  about:
    "I'm Yathish — I love learning new tech and building projects that are actually useful. Here are some of the tools I work with:",
}

// Your contact info & social links
export const contact = {
  email: 'hello@example.com',
  linkedin: 'https://linkedin.com/in/your-username',
  github: 'https://github.com/your-username',
  twitter: '', // leave empty ('') to hide
  instagram: '', // leave empty ('') to hide
  resume: '', // link to your resume PDF, leave empty to hide
}

export const skills = ['JavaScript', 'React', 'Tailwind CSS', 'Node.js', 'HTML', 'CSS', 'Git']

export const projects = [
  {
    title: 'Project One',
    description: 'A short description of what this project does and the problem it solves.',
    tags: ['React', 'Tailwind'],
    link: '#',
  },
  {
    title: 'Project Two',
    description: 'Another project you are proud of. Swap in your real work here.',
    tags: ['Node.js', 'API'],
    link: '#',
  },
  {
    title: 'Project Three',
    description: 'Something fun or experimental you built while learning.',
    tags: ['JavaScript'],
    link: '#',
  },
]

// Builds the contact links list automatically — empty values are skipped.
export const links = [
  { label: 'Email', href: contact.email && `mailto:${contact.email}` },
  { label: 'LinkedIn', href: contact.linkedin },
  { label: 'GitHub', href: contact.github },
  { label: 'Twitter', href: contact.twitter },
  { label: 'Instagram', href: contact.instagram },
  { label: 'Resume', href: contact.resume },
].filter((l) => l.href)
