# דאשבורד לניהול לידים חכם

פרויקט הדגמה לימודי: דאשבורד סטטי בעברית לניהול לידים בעסק קטן. כל הנתונים פיקטיביים.

> **סטטוס:** כרטיסים, תרשים, טבלה, סימון איחור, דירוג, חיפוש וסינון. עדיין אין פרטי ליד, הוספה, עריכה ושמירה. הנתונים נוצרים מחדש בכל טעינה.

## ענפים ותלות זמנית

| ענף | נוצר מתוך | תוכן |
| --- | --- | --- |
| `main` | - | מסמכים בלבד |
| `test/setup` | `main` | תשתית בדיקות |
| `feature/logic-core` | `test/setup` | שכבת הלוגיקה ונתוני הדמה |
| `feature/dashboard-view` | `feature/logic-core` | תצוגה לקריאה בלבד |
| `feature/filters` | `feature/dashboard-view` | חיפוש וסינון |

הענפים בנויים כשרשרת: כל ענף נוצר מהקודם ולא מתוך `main`. זה חריג זמני ומאושר לכלל ב-`Practice.md` (סעיף 3), כי הענפים הקודמים עוד לא מוזגו ל-`main`. כל ענף תלוי בקודם לו, ולכן ממזגים לפי הסדר: `test/setup`, `feature/logic-core`, `feature/dashboard-view` ואחריו `feature/filters`. אחרי המיזוג חוזרים ליצור ענפים מתוך `main`.

## מסמכים

- [SPEC.md](SPEC.md) - האפיון וקריטריוני הקבלה
- [Practice.md](Practice.md) - איך עובדים על הפרויקט ומול GitHub
- [TEST_PLAN.md](TEST_PLAN.md) - תרחישי הבדיקה לכל קריטריון

## הרצה מקומית

הקוד נטען כ-ES modules, ולכן צריך שרת סטטי ולא פתיחה ישירה של הקובץ:

```bash
npm install
npx serve .
```

ואז פותחים בדפדפן את `http://localhost:3000`.

## בדיקות

```bash
npm install
npx playwright install chromium
npm test          # בדיקות לוגיקה
npm run test:ui   # בדיקות ממשק, מחשב וסלולרי
npm run test:all  # הכל
```
