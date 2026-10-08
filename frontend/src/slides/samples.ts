import type { LayoutId, SlideContent } from '../design/types'

/** Realistic sample content for every layout (used by /gallery and tests). Lengths sit near the real limits. */
export const SAMPLES: Record<LayoutId, SlideContent> = {
  'cover-hero': {
    eyebrow: 'Seed round · 2026',
    title: 'Pulse: the AI coach that fits your life',
    subtitle: 'Personal training that adapts every day to your sleep, stress and schedule. For the price of a gym latte.',
    meta: 'Maya Chen, CEO · October 2026',
  },
  'cover-split': {
    eyebrow: 'Investor presentation',
    title: 'Fitness that finally adapts to you',
    subtitle: 'An AI coach that turns wearable data into a daily plan people actually follow.',
    meta: 'Pulse Labs · Series A',
    image: { url: '/sample/fitness.jpg', query: 'athlete lifting barbell gym' },
  },
  'cover-editorial': {
    eyebrow: 'Annual report',
    title: 'The year we moved',
    subtitle: 'How 2.4 million people built a training habit that stuck, and what we learned from 180 million workouts.',
    meta: 'Vol. 04 · 2026',
  },
  agenda: {
    eyebrow: 'Today',
    title: 'Agenda',
    subtitle: 'Forty minutes, five parts, plenty of time for questions.',
    items: [
      { title: 'The problem', text: 'Why 80% of fitness resolutions fail by February' },
      { title: 'Our solution', text: 'An adaptive coach built on your own data' },
      { title: 'Traction', text: 'Growth, retention and what users say' },
      { title: 'Business model', text: 'Subscriptions, partners and unit economics' },
      { title: 'The ask', text: 'Raising $12M to scale to five new markets' },
    ],
  },
  'section-divider': {
    eyebrow: 'Part two',
    title: 'Product and technology',
    subtitle: 'What we built, how it learns, and why it is hard to copy.',
    meta: '02',
  },
  'big-statement': {
    eyebrow: 'Our belief',
    title: 'The best workout plan is the one you will actually do tomorrow.',
    highlight: 'actually do',
    subtitle: 'Consistency beats intensity. Pulse is designed around that single idea.',
  },
  'title-bullets': {
    eyebrow: 'Why now',
    title: 'Three shifts make adaptive coaching possible',
    subtitle: 'The ingredients finally exist at consumer prices and scale.',
    bullets: [
      'Over 40% of adults now wear a device that tracks heart rate, sleep and recovery every night',
      'On-device AI models can personalise a plan in milliseconds without sending health data to the cloud',
      'Gyms and insurers are actively looking for digital partners to improve member retention',
      'Post-pandemic, hybrid home and gym training has become the default for most people',
    ],
  },
  'stats-big-numbers': {
    eyebrow: 'Traction',
    title: 'Growing fast, and people stay',
    subtitle: 'Eighteen months after launch, with almost no paid marketing.',
    items: [
      { value: '2.4M', label: 'Active members', text: 'Up from 300K a year ago, 70% from word of mouth' },
      { value: '68%', label: '12-month retention', text: 'Three times the fitness-app industry average' },
      { value: '4.9★', label: 'App Store rating', text: 'From over 85,000 reviews across 30 countries' },
    ],
  },
  'kpi-cards': {
    eyebrow: 'Q3 performance',
    title: 'Every core metric moved up this quarter',
    subtitle: 'Quarter over quarter, all regions combined.',
    items: [
      { icon: 'users', value: '2.4M', label: 'Monthly actives', delta: '+18%', text: 'Strongest growth in Germany and Japan' },
      { icon: 'dollar-sign', value: '$9.8M', label: 'Revenue', delta: '+24%', text: 'Annual plans now 61% of new sales' },
      { icon: 'heart-pulse', value: '4.1', label: 'Workouts / week', delta: '+0.6', text: 'Adaptive plans drive higher frequency' },
      { icon: 'timer', value: '$31', label: 'Acquisition cost', delta: '-12%', text: 'Referral program now 40% of signups' },
    ],
  },
  'icon-grid-3': {
    eyebrow: 'How Pulse is different',
    title: 'A coach that learns, adapts and motivates',
    subtitle: 'Three capabilities no static workout app can match.',
    items: [
      { icon: 'brain', title: 'Learns your body', text: 'Reads sleep, heart-rate variability and soreness to understand how ready you are today.' },
      { icon: 'sliders-horizontal', title: 'Adapts every day', text: 'Rebuilds the session around your time, equipment and energy, so missing a day never derails you.' },
      { icon: 'trophy', title: 'Keeps you going', text: 'Small wins, streaks and friendly nudges designed with behavioural scientists, not just gamers.' },
    ],
  },
  'icon-grid-4': {
    eyebrow: 'Platform',
    title: 'Everything a member needs, in one app',
    subtitle: 'Built for beginners and serious athletes alike.',
    items: [
      { icon: 'dumbbell', title: 'Strength', text: 'Progressive plans for home, gym or hotel room with form tips.' },
      { icon: 'activity', title: 'Cardio', text: 'Heart-rate zones tuned to your fitness, not a generic formula.' },
      { icon: 'moon', title: 'Recovery', text: 'Sleep and mobility routines that respond to how you feel.' },
      { icon: 'utensils', title: 'Nutrition', text: 'Simple meal guidance that fits your goals and your culture.' },
    ],
  },
  'icon-grid-6': {
    eyebrow: 'Under the hood',
    title: 'Built on a modern, private-by-design stack',
    items: [
      { icon: 'cpu', title: 'On-device AI', text: 'Plans are generated on the phone in under 50 ms.' },
      { icon: 'shield-check', title: 'Private by default', text: 'Health data never leaves the device unencrypted.' },
      { icon: 'smartphone', title: 'Every wearable', text: 'Works with Apple, Garmin, Fitbit, Oura and Whoop.' },
      { icon: 'globe', title: '30 languages', text: 'Coaching voice and content localised by natives.' },
      { icon: 'workflow', title: 'Open API', text: 'Gyms and clinics plug Pulse into their own apps.' },
      { icon: 'chart-line', title: 'Live insights', text: 'Members see progress trends, not just raw numbers.' },
    ],
  },
  'image-text-left': {
    eyebrow: 'The experience',
    title: 'A plan that greets you every morning',
    body: 'Open the app and your session is already waiting, rebuilt overnight from how you slept and how hard you trained yesterday.',
    bullets: ['Ready in one tap, no planning required', 'Swaps exercises when equipment is busy', 'Voice coaching that sounds human'],
    image: { url: '/sample/workspace.jpg', query: 'person using phone app' },
  },
  'image-text-right': {
    eyebrow: 'For gyms',
    title: 'A retention engine for fitness clubs',
    body: 'Clubs offer Pulse to members as a white-label coach. Members who use it visit 2.3× more often and are far less likely to cancel.',
    bullets: ['White-label app in two weeks', 'Revenue share on every member', 'Dashboard for coaches and managers'],
    image: { query: 'modern gym interior' },
  },
  'full-bleed-image': {
    eyebrow: 'Our mission',
    title: 'Help a billion people move a little more, every day',
    subtitle: 'Because the hardest part of fitness was never the workout. It was showing up.',
    image: { url: '/sample/landscape.jpg', query: 'mountain sunrise landscape' },
  },
  timeline: {
    eyebrow: 'Roadmap',
    title: 'From app to health platform in three years',
    items: [
      { value: '2024', title: 'Launch', text: 'Adaptive strength plans in the US and UK' },
      { value: '2025', title: 'Wearables', text: 'Sleep and HRV integration with all major devices' },
      { value: '2026', title: 'Gym partners', text: 'White-label coach live in 400 clubs' },
      { value: '2027', title: 'Health plans', text: 'Insurers reimburse Pulse as preventive care' },
      { value: '2028', title: 'Global', text: 'Five new markets and 25 million members' },
    ],
  },
  'process-steps': {
    eyebrow: 'How it works',
    title: 'From signup to habit in four steps',
    subtitle: 'Most members complete their first workout within ten minutes.',
    items: [
      { icon: 'user-round', title: 'Tell us about you', text: 'A two-minute chat about goals, schedule and injuries.' },
      { icon: 'link', title: 'Connect a wearable', text: 'Optional, but it makes every plan noticeably smarter.' },
      { icon: 'calendar', title: 'Get today’s plan', text: 'A session that fits your time, space and energy level.' },
      { icon: 'trending-up', title: 'Watch it adapt', text: 'Every workout teaches the coach what works for you.' },
    ],
  },
  comparison: {
    eyebrow: 'Positioning',
    title: 'Static apps versus an adaptive coach',
    items: [
      { icon: 'file-text', title: 'Typical fitness app', text: 'The same 12-week program for everyone.', bullets: ['Fixed plans, generic intensity', 'Missed days break the program', 'Motivation fades after week three'] },
      { icon: 'sparkles', title: 'Pulse', text: 'A new plan every day, built for you.', bullets: ['Adapts to sleep, stress and soreness', 'Reschedules around your real life', 'Coaching that keeps you consistent'] },
    ],
  },
  'before-after': {
    eyebrow: 'Member story',
    title: 'What changes in the first 90 days',
    items: [
      { title: 'Before Pulse', bullets: ['Gym twice a month, then guilt', 'No idea what to do on arrival', 'Gave up after minor injuries'] },
      { title: 'After 90 days', bullets: ['Training four times a week', 'Walks in with a plan, done in 40 min', 'Plans route around a sore knee'] },
    ],
  },
  'pros-cons': {
    eyebrow: 'Risk review',
    title: 'Expanding into corporate wellness',
    items: [
      { title: 'Opportunities', bullets: ['Large budgets already allocated to wellness', 'Lower churn on annual B2B contracts', 'Aggregated data improves our models', 'Strong pull from existing members'] },
      { title: 'Risks', bullets: ['Longer sales cycles of six to nine months', 'Procurement and security reviews', 'Employers may expect custom features', 'Privacy concerns from employees'] },
    ],
  },
  'chart-insight': {
    eyebrow: 'Retention',
    title: 'Adaptive plans keep members training',
    chart: {
      type: 'line',
      categories: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
      series: [
        { name: 'Pulse', values: [92, 86, 81, 77, 74, 72] },
        { name: 'Industry average', values: [70, 48, 36, 29, 25, 22] },
      ],
      unit: '%',
    },
    items: [
      { value: '3.3×', text: 'more members still active after six months than the category average' },
      { value: '72%', text: 'of month-one members are still training in month six' },
    ],
  },
  'chart-full': {
    eyebrow: 'Revenue',
    title: 'Revenue has tripled in four quarters',
    subtitle: 'Quarterly revenue in $M. Growth driven by annual plans and gym partnerships.',
    chart: {
      type: 'bar',
      categories: ['Q4 ’25', 'Q1 ’26', 'Q2 ’26', 'Q3 ’26', 'Q4 ’26e', 'Q1 ’27e'],
      series: [{ name: 'Revenue', values: [3.2, 4.6, 7.9, 9.8, 12.4, 15.1] }],
      unit: '$M',
    },
  },
  table: {
    eyebrow: 'Plans',
    title: 'How the plans compare',
    subtitle: 'All plans include unlimited adaptive workouts.',
    table: {
      headers: ['Feature', 'Free', 'Plus', 'Pro'],
      rows: [
        ['Adaptive daily plan', '3 per week', 'Unlimited', 'Unlimited'],
        ['Wearable sync', '—', 'Yes', 'Yes'],
        ['Nutrition guidance', '—', 'Basic', 'Personalised'],
        ['Human coach check-ins', '—', '—', 'Monthly'],
        ['Price per month', '$0', '$9.99', '$24.99'],
      ],
    },
  },
  quote: {
    quote: 'I have tried every fitness app. Pulse is the first one that noticed I was exhausted and told me to take it easy.',
    author: 'Priya Raman',
    role: 'Member since 2025, London',
  },
  testimonials: {
    eyebrow: 'Loved by members',
    title: 'What people say after their first month',
    items: [
      { text: 'Six months in and I have not missed a week. It moves my workouts around my kids’ schedule.', title: 'Daniel Okafor', label: 'Father of three, Lagos' },
      { text: 'The recovery days are a game changer. My running has improved and my knees stopped hurting.', title: 'Sofia Marquez', label: 'Marathon runner, Madrid' },
      { text: 'As a coach I was sceptical. Now I recommend it to every client who travels for work.', title: 'Kenji Watanabe', label: 'Personal trainer, Tokyo' },
    ],
  },
  'team-grid': {
    eyebrow: 'Team',
    title: 'Built by coaches, scientists and engineers',
    subtitle: 'Forty people across London, Berlin and Singapore.',
    items: [
      { title: 'Maya Chen', label: 'CEO & co-founder', text: 'Ex-Strava product lead, ultramarathon runner' },
      { title: 'Lukas Weber', label: 'CTO & co-founder', text: 'Built on-device ML at Google Fit' },
      { title: 'Amara Diallo', label: 'Head of Science', text: 'PhD in exercise physiology, Loughborough' },
      { title: 'Ravi Patel', label: 'Head of Growth', text: 'Scaled Headspace across Asia-Pacific' },
    ],
  },
  'pricing-tiers': {
    eyebrow: 'Pricing',
    title: 'Simple plans that grow with you',
    items: [
      { title: 'Starter', value: '$0', label: '/ month', text: 'Try adaptive coaching with no commitment.', bullets: ['3 adaptive workouts a week', 'Basic progress tracking', 'Community challenges'] },
      { title: 'Plus', value: '$9.99', label: '/ month', text: 'Everything you need to train consistently.', bullets: ['Unlimited adaptive plans', 'Wearable sync and recovery', 'Nutrition guidance', 'Offline workouts'], highlight: true },
      { title: 'Pro', value: '$24.99', label: '/ month', text: 'For serious goals and expert support.', bullets: ['Everything in Plus', 'Monthly human coach call', 'Race and event plans'] },
    ],
  },
  'problem-solution': {
    eyebrow: 'The opportunity',
    title: 'Fitness apps are easy to start and easy to quit',
    items: [
      { icon: 'triangle-alert', title: 'The problem', text: 'Static plans ignore real life. One busy week or a bad night of sleep and people fall off the program for good.', bullets: ['80% quit within 3 months', 'Generic plans cause injuries'] },
      { icon: 'lightbulb', title: 'Our solution', text: 'An AI coach that rebuilds your plan every day around your body, schedule and mood.', bullets: ['Adapts to sleep and recovery', 'Reschedules missed sessions', 'Keeps streaks realistic'] },
    ],
  },
  'market-size': {
    eyebrow: 'Market',
    title: 'A large market moving to digital',
    items: [
      { label: 'TAM', value: '$96B', title: 'Global fitness and wellness apps', text: 'All consumer spend on digital fitness, coaching and wellness' },
      { label: 'SAM', value: '$24B', title: 'Personalised training', text: 'Wearable owners paying for coaching in our 12 launch markets' },
      { label: 'SOM', value: '$1.2B', title: 'Five-year target', text: '5% share of personalised training via direct and gym channels' },
    ],
  },
  swot: {
    eyebrow: 'Strategy',
    title: 'Where we stand today',
    items: [
      { title: 'Strengths', bullets: ['Best-in-class retention', 'Proprietary adaptive engine', 'Strong community brand'] },
      { title: 'Weaknesses', bullets: ['Small enterprise sales team', 'Limited Android wearable data'] },
      { title: 'Opportunities', bullets: ['Insurers paying for prevention', 'Gym chains seeking digital tools', 'Ageing, health-aware population'] },
      { title: 'Threats', bullets: ['Big tech bundling free fitness', 'Health data regulation tightening'] },
    ],
  },
  closing: {
    eyebrow: 'Join us',
    title: 'Let’s get the world moving',
    subtitle: 'We are raising $12M to bring adaptive coaching to five new markets. We would love you on board.',
    items: [
      { icon: 'mail', text: 'maya@pulse.fit' },
      { icon: 'globe', text: 'pulse.fit/investors' },
      { icon: 'phone', text: '+44 20 7946 0958' },
    ],
  },
}
