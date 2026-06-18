import { ServiceError } from '../utils/errors.js';
import { localeLabel } from '../utils/locales.js';

export async function authenticateReviewer({ db, reviewerId, locale }) {
  const result = await db.query(
    `
      SELECT id, name, locale
      FROM reviewers
      WHERE id = $1 AND locale = $2
      LIMIT 1;
    `,
    [reviewerId, locale]
  );

  if (result.rowCount !== 1) {
    throw new ServiceError(401, 'INVALID_REVIEWER', 'Reviewer id and locale do not match.');
  }

  const reviewer = result.rows[0];
  return {
    id: reviewer.id,
    name: reviewer.name,
    locale: reviewer.locale,
    localeLabel: localeLabel(reviewer.locale)
  };
}

