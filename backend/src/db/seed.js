const seededReviewers = [
  [1, 'Avery West', 'WEST_COAST'],
  [2, 'Blair East', 'EAST_COAST'],
  [3, 'Casey Midwest', 'MIDWEST'],
  [4, 'Devon South', 'SOUTH'],
  [5, 'Elliot West', 'WEST_COAST'],
  [6, 'Finley East', 'EAST_COAST']
];

const ticketTitles = {
  WEST_COAST: [
    'San Francisco creator appeal',
    'Los Angeles brand safety review',
    'Portland policy escalation',
    'Seattle duplicate report',
    'San Diego account context',
    'Oakland copyright review',
    'Sacramento quality check',
    'Las Vegas regional moderation',
    'Phoenix local listing check',
    'Reno community report',
    'Fresno image review',
    'Spokane profile verification'
  ],
  EAST_COAST: [
    'New York marketplace review',
    'Boston comment appeal',
    'Philadelphia safety check',
    'Miami image moderation',
    'Atlanta creator review',
    'Charlotte listing appeal',
    'Baltimore report triage',
    'Orlando policy review',
    'Raleigh account check',
    'Newark duplicate report',
    'Tampa content escalation',
    'Providence profile review'
  ],
  MIDWEST: [
    'Chicago local policy review',
    'Detroit account report',
    'Minneapolis image check',
    'Cleveland appeal review',
    'Kansas City listing review',
    'St. Louis creator report',
    'Madison policy escalation',
    'Indianapolis brand safety',
    'Milwaukee duplicate review',
    'Omaha profile check',
    'Columbus comment appeal',
    'Des Moines content review'
  ],
  SOUTH: [
    'Austin creator appeal',
    'Dallas marketplace report',
    'Houston image review',
    'Nashville policy check',
    'New Orleans safety review',
    'Memphis duplicate report',
    'Birmingham listing appeal',
    'Little Rock profile check',
    'Jackson content escalation',
    'San Antonio brand safety',
    'Tulsa account review',
    'Charleston moderation report'
  ]
};

export async function seedDatabase(db) {
  for (const [id, name, locale] of seededReviewers) {
    await db.query(
      `
        INSERT INTO reviewers (id, name, locale)
        VALUES ($1, $2, $3)
        ON CONFLICT (id)
        DO UPDATE SET name = EXCLUDED.name, locale = EXCLUDED.locale;
      `,
      [id, name, locale]
    );
  }

  const ticketCount = await db.query('SELECT COUNT(*)::int AS count FROM tickets;');
  if (ticketCount.rows[0].count > 0) {
    return;
  }

  for (const [locale, titles] of Object.entries(ticketTitles)) {
    for (const title of titles) {
      await db.query(
        'INSERT INTO tickets (title, locale, status, active) VALUES ($1, $2, $3, TRUE);',
        [title, locale, 'AVAILABLE']
      );
    }
  }
}
