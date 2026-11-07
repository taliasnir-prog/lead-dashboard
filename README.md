# דאשבורד לניהול לידים חכם

פרויקט הדגמה לימודי: דאשבורד סטטי בעברית לניהול לידים בעסק קטן. כל הנתונים פיקטיביים.

> **סטטוס:** אפיון, תשתית בדיקות ושכבת לוגיקה (`js/logic.js`, `js/demo-data.js`). הממשק עוד לא נבנה.

## ענפים ותלות זמנית

| ענף | נוצר מתוך | תוכן |
| --- | --- | --- |
| `main` | - | מסמכים בלבד |
| `test/setup` | `main` | תשתית בדיקות |
| `feature/logic-core` | `test/setup` | שכבת הלוגיקה ונתוני הדמה |

`feature/logic-core` נוצר מתוך `test/setup` ולא מתוך `main`. זה חריג זמני ומאושר לכלל ב-`Practice.md` (סעיף 3), כי תשתית הבדיקות עוד לא מוזגה ל-`main`. הענף תלוי ב-`test/setup`, ולכן ממזגים קודם את `test/setup` ל-`main` ורק אחריו את `feature/logic-core`. אחרי המיזוג חוזרים ליצור ענפים מתוך `main`.

## מסמכים

- [SPEC.md](SPEC.md) - האפיון וקריטריוני הקבלה
- [Practice.md](Practice.md) - איך עובדים על הפרויקט ומול GitHub
- [TEST_PLAN.md](TEST_PLAN.md) - תרחישי הבדיקה לכל קריטריון

## הרצה מקומית

הקוד נטען כ-ES modules, ולכן צריך שרת סטטי ולא פתיחה ישירה של הקובץ:

```bash
npx serve .
```

## בדיקות

```bash
npm install
npx playwright install chromium
npm test          # בדיקות לוגיקה
npm run test:ui   # בדיקות ממשק, מחשב וסלולרי
npm run test:all  # הכל
```
