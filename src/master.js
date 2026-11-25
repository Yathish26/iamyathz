// ============================================================
//  master.js — edit everything about your portfolio here.
//  The page (App.jsx) reads all its content from this file.
// ============================================================

export const profile = {
  name: 'Yathish Acharya',
  location: 'Mangalore (Mangaluru) & Bengaluru, Karnataka, India', // '' to hide
  servicesIntro:
    'Developer services for clients in Mangalore, across Karnataka and India, and remotely worldwide.',
  handle: 'iamyathz',
  logo: '/logo.png', // header logo image (lives in the public/ folder)
  cv: '/Yathish_CV.pdf', // downloadable CV (replace the file in public/ to update it, '' to hide)
  tagline: 'I build apps, bots, automations & AI agents.',
  intro:
    "I'm a developer who turns ideas into working products — websites, mobile apps, Telegram bots, scrapers, AI agents, automation tools, and data analysis that turns messy numbers into clear answers.",
  about:
    "I'm Yathish Acharya, a full stack developer from Mangalore (Mangaluru), Karnataka, India, also working from Bengaluru. I love learning new tech and building projects that are actually useful. Here are the tools I work with:",
}

// Emails — primary is shown big, alternates are shown smaller underneath
export const emails = {
  primary: 'yathishkumar2013@gmail.com',
  alternates: ['yathishkumar026@gmail.com', 'iamyathz@icloud.com'],
}

// FAQ section — if you change these, also update the matching FAQPage block in index.html
export const faqs = [
  {
    q: 'Are you a developer based in Mangalore?',
    a: "Yes. I'm Yathish Acharya, a full stack developer based in Mangalore (Mangaluru), Karnataka, India, and I also work from Bengaluru. I work with clients in Mangalore, across Karnataka and India, and remotely worldwide.",
  },
  {
    q: 'What can you build?',
    a: 'Websites and web apps, Android and iOS mobile apps, Telegram bots, web scraping tools, automations, AI agents, and data analysis, data cleaning and dashboards.',
  },
  {
    q: 'Which technologies do you use?',
    a: 'JavaScript and Python, with React.js, Next.js, React Native, Expo, Node.js, Express.js, MongoDB, PostgreSQL, Redis, AWS and Google Cloud.',
  },
  {
    q: 'What have you built?',
    a: 'Grojet, a delivery platform with customer, merchant and rider apps on Android and iOS, plus Seva Mein, Hirearrive and Cuisineberg.',
  },
  {
    q: 'How can I hire you?',
    a: 'Email yathishkumar2013@gmail.com or call +91 8073215402.',
  },
]

// Phone — set to '' to hide
export const phone = '+91 8073215402'

// Social links — remove a line to hide it, or add new ones
export const socials = [
  // icon options: github, linkedin, instagram, threads, x, youtube, gitlab, mail (see src/icons.jsx)
  { label: 'GitHub', icon: 'github', href: 'https://github.com/Yathish26' },
  { label: 'LinkedIn', icon: 'linkedin', href: 'https://www.linkedin.com/in/iamyathz/' },
  { label: 'Instagram', icon: 'instagram', href: 'https://www.instagram.com/iam.yathz/' },
  { label: 'Threads', icon: 'threads', href: 'https://www.threads.com/@iam.yathz' },
  { label: 'X', icon: 'x', href: 'https://x.com/iamyathz' },
  { label: 'YouTube', icon: 'youtube', href: 'https://www.youtube.com/@iamyathz' },
  { label: 'GitLab', icon: 'gitlab', href: 'https://gitlab.com/iamyathz' },
]

// "What I build" section — page: links the card to its service page in src/servicePages.js
// icon options: globe, smartphone, zap, send, search, bot, chart, filter, dashboard (see src/icons.jsx)
export const services = [
  {
    title: 'Websites & Web Apps',
    icon: 'globe',
    page: 'website-developer-mangalore',
    description: 'Fast, modern websites and full web platforms, from landing pages to dashboards.',
  },
  {
    title: 'Mobile Apps',
    icon: 'smartphone',
    page: 'app-developer-mangalore',
    description: 'iOS and Android apps shipped to the App Store and Google Play.',
  },
  {
    title: 'Automations',
    icon: 'zap',
    page: 'automation-developer-mangalore',
    description: 'Workflows and tools that connect apps and take repetitive work off your plate.',
  },
  {
    title: 'Telegram Bots',
    icon: 'send',
    page: 'telegram-bot-developer-mangalore',
    description: 'Bots for notifications, orders, support, communities and anything in between.',
  },
  {
    title: 'Web Scraping',
    icon: 'search',
    page: 'web-scraping-services-mangalore',
    description: 'Collecting and cleaning data from websites and turning it into something useful.',
  },
  {
    title: 'AI Agents',
    icon: 'bot',
    page: 'ai-agent-developer-mangalore',
    description: 'AI-powered agents and assistants that read, decide and act on your behalf.',
  },
  {
    title: 'Data Analysis & Stats',
    icon: 'chart',
    page: 'data-analysis-services-mangalore',
    description: 'Digging into data to find trends and answers, and turning numbers into clear stats.',
  },
  {
    title: 'Data Cleaning',
    icon: 'filter',
    page: 'data-analysis-services-mangalore',
    description: 'Fixing messy, duplicate and broken data so it is accurate and ready to use.',
  },
  {
    title: 'Dashboards & Reports',
    icon: 'dashboard',
    page: 'data-analysis-services-mangalore',
    description: 'Charts, dashboards and reports that make your data easy to read and share.',
  },
]

// Skills (from CV) — grouped by category
export const skills = [
  { category: 'Languages', items: ['JavaScript', 'Python'] },
  { category: 'Frontend', items: ['React.js', 'React Native', 'Next.js', 'Tailwind CSS', 'Expo'] },
  { category: 'Backend', items: ['Node.js', 'Express.js', 'REST APIs', 'WebSockets'] },
  { category: 'Databases', items: ['MongoDB', 'PostgreSQL', 'Redis'] },
  {
    category: 'Cloud & Deployment',
    items: ['AWS (EC2, S3)', 'Google Cloud Platform', 'Render', 'Vercel'],
  },
  {
    category: 'Tools & Technologies',
    items: ['Git', 'GitHub', 'PM2', 'Axios', 'Razorpay', 'Google Maps / Places API'],
  },
]

// Projects
//  - link:  main website (title becomes clickable)
//  - links: extra buttons (app stores, etc.)
//  - note:  small extra line of info
//  - icon:  app icon image (put it in public/projects/)
export const projects = [
  {
    title: 'Grojet',
    description:
      'A delivery platform where customers can place orders and get parcels delivered — available on the web, iOS and Android.',
    tags: ['Web', 'iOS', 'Android', 'React Native'],
    link: 'https://grojetdelivery.com',
    icon: '/projects/grojet.png',
    featured: true,
    links: [
      { label: 'Website', href: 'https://grojetdelivery.com' },
      { label: 'App Store', href: 'https://apps.apple.com/in/app/grojet-delivery/id6755365568' },
      { label: 'Google Play', href: 'https://play.google.com/store/apps/details?id=com.grojet.app' },
    ],
  },
  {
    title: 'Grojet Merchants',
    description: 'The app for stores and merchants on Grojet to manage their orders and deliveries.',
    tags: ['iOS', 'Android', 'React Native'],
    icon: '/projects/grojet-merchants.png',
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/us/app/grojet-merchants/id6753089039' },
      { label: 'Google Play', href: 'https://play.google.com/store/apps/details?id=com.grojet.merchant' },
    ],
  },
  {
    title: 'Grojet Go',
    description: 'A native rider app that Grojet delivery partners use to pick up and deliver parcels.',
    tags: ['Android', 'Native'],
    icon: '/projects/grojet-go.png',
    note: 'Private APK — not listed on the app stores.',
  },
  {
    title: 'Seva Mein',
    description:
      'Get help nearby in Mangaluru. A peer-to-peer platform connecting people with KYC-verified locals and students — post a task, compare offers and get help in minutes, or earn by helping your neighbours.',
    tags: ['Web', 'Marketplace', 'Local Jobs'],
    link: 'https://www.sevamein.com/',
    icon: '/projects/sevamein.png',
  },
  {
    title: 'Hirearrive',
    description:
      'A job site connecting job seekers with employers. Search jobs, build your profile and resume, and hire talent across industries.',
    tags: ['Web', 'Job Portal'],
    link: 'https://hirearrive.in/',
    icon: '/projects/hirearrive.svg',
  },
  {
    title: 'Cuisineberg',
    description:
      'The Art of Fine Dine — a modern dine-in platform. Customers view the menu on their phone and place customized orders, while restaurants get KOT billing, pantry tracking and business analytics in one place.',
    tags: ['Web', 'Restaurant SaaS'],
    link: 'https://cuisineberg.com/',
    icon: '/projects/cuisineberg.png',
  },
]
