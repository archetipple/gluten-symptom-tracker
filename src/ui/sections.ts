/** The five sections, shared by the home screen and the bottom tab bar. */
export const SECTIONS = [
  { to: '/today', label: 'Today', icon: '◉', blurb: 'Check-in, meds and the day so far', also: ['/settings', '/meds'] },
  { to: '/food', label: 'Food', icon: '◈', blurb: 'Log meals and check foods', also: ['/meal', '/foods'] },
  { to: '/symptoms', label: 'Symptoms', icon: '✚', blurb: 'Symptoms and digestion', also: ['/symptom', '/bowel'] },
  { to: '/patterns', label: 'Patterns', icon: '▤', blurb: 'What lines up with symptoms', also: [] as string[] },
  { to: '/places', label: 'Places', icon: '✦', blurb: 'Where it feels safe to eat', also: [] as string[] },
];
