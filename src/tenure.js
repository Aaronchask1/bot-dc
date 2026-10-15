// Discord usa estos escalones para las insignias de Server Boost.
const BOOST_MILESTONES = [1, 2, 3, 6, 9, 12, 15, 18, 24];

function addMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

function durationParts(from, to = new Date()) {
  if (to <= from) return { years: 0, months: 0, days: 0, hours: 0 };

  let cursor = new Date(from);
  let years = 0;
  while (addMonths(cursor, 12) <= to) {
    cursor = addMonths(cursor, 12);
    years += 1;
  }

  let months = 0;
  while (addMonths(cursor, 1) <= to) {
    cursor = addMonths(cursor, 1);
    months += 1;
  }

  const remainingMs = to - cursor;
  return {
    years,
    months,
    days: Math.floor(remainingMs / 86_400_000),
    hours: Math.floor((remainingMs % 86_400_000) / 3_600_000),
  };
}

// En español "mes" en plural es "meses", así que no se puede solo agregar una "s".
const UNITS = [
  ['years', 'año', 'años'],
  ['months', 'mes', 'meses'],
  ['days', 'día', 'días'],
  ['hours', 'hora', 'horas'],
];

function formatDuration(parts) {
  const words = UNITS
    .filter(([key]) => parts[key] > 0)
    .map(([key, singular, plural]) => `${parts[key]} ${parts[key] === 1 ? singular : plural}`);

  if (words.length === 0) return 'menos de 1 hora';
  if (words.length === 1) return words[0];
  // "2 meses, 21 días y 3 horas" en vez de "2 meses, 21 días, 3 horas".
  return `${words.slice(0, -1).join(', ')} y ${words.at(-1)}`;
}

function nextMilestone(startDate, milestones = BOOST_MILESTONES) {
  const now = new Date();
  const milestone = milestones.find((months) => addMonths(startDate, months) > now);
  if (!milestone) return null;

  const date = addMonths(startDate, milestone);
  return { milestone, date, remaining: formatDuration(durationParts(now, date)) };
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date > new Date() ? null : date;
}

module.exports = {
  formatDuration,
  durationParts,
  nextMilestone,
  parseDate,
};
