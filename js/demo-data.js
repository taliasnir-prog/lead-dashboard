// Fictional demo leads (SPEC.md section 6, "נתוני הדמה").
// All names are invented. Phone is empty on purpose: a valid-looking number could belong to a real person.
// Emails use the reserved domain example.com only.
// Dates are stored as day offsets from "today" and become real dates in createDemoLeads(today),
// so the demo looks the same on any day it is opened.

import { addDays } from './logic.js';

const R1 = 'נועה ברק';
const R2 = 'איתי שמש';
const R3 = 'מאיה גל';
const R4 = 'עומר טל';

// [id, name, source, rep, status, interest, value, followUpOffset (null = no date), email]
const TEMPLATES = [
  // חדש (7)
  ['L-001', 'אורי לוינסון', 'Facebook', R1, 'חדש', 'גבוהה', 9000, -2, 'lead001@example.com'],
  ['L-002', 'שירה אלמוג', 'Google', R2, 'חדש', 'בינונית', 6000, 0, 'lead002@example.com'],
  ['L-003', 'רון אדלר', 'אתר', R3, 'חדש', 'נמוכה', 2500, null, 'lead003@example.com'],
  ['L-004', 'טל ברנע', 'Facebook', R4, 'חדש', 'בינונית', 4000, 2, 'lead004@example.com'],
  ['L-005', 'הילה שחר', 'הפניה', R1, 'חדש', 'גבוהה', 11000, null, 'lead005@example.com'],
  ['L-006', 'גיל נחמיאס', 'Google', R2, 'חדש', 'נמוכה', 1500, 6, ''],
  ['L-007', 'ליאת קורן', 'Facebook', R3, 'חדש', 'בינונית', 3500, 4, 'lead007@example.com'],
  // נוצר קשר (7)
  ['L-008', 'עידו רבינוביץ', 'Facebook', R4, 'נוצר קשר', 'גבוהה', 14000, -1, 'lead008@example.com'],
  // Needed by AC-5.5: "נוצר קשר", medium interest, follow-up in 10 days (score 2, low).
  ['L-009', 'מורן זילבר', 'אתר', R1, 'נוצר קשר', 'בינונית', 5000, 10, 'lead009@example.com'],
  ['L-010', 'אסף גלעדי', 'Google', R2, 'נוצר קשר', 'נמוכה', 2000, -5, 'lead010@example.com'],
  ['L-011', 'נטע פלג', 'Facebook', R3, 'נוצר קשר', 'בינונית', 7000, null, 'lead011@example.com'],
  ['L-012', 'יובל הראל', 'הפניה', R4, 'נוצר קשר', 'גבוהה', 16000, 3, 'lead012@example.com'],
  ['L-013', 'דנה אופיר', 'אתר', R1, 'נוצר קשר', 'נמוכה', 3000, 14, 'lead013@example.com'],
  ['L-014', 'אלון ששון', 'Google', R2, 'נוצר קשר', 'בינונית', 4500, 0, 'lead014@example.com'],
  // במעקב (7)
  // Needed by AC-8.3: "במעקב", medium interest, follow-up in 10 days (score 2, low).
  ['L-015', 'קרן מלכה', 'Facebook', R3, 'במעקב', 'בינונית', 10000, 10, 'lead015@example.com'],
  ['L-016', 'שי אברבנאל', 'Google', R4, 'במעקב', 'גבוהה', 18000, -3, 'lead016@example.com'],
  ['L-017', 'מיכל דגן', 'אתר', R1, 'במעקב', 'בינונית', 6500, -8, 'lead017@example.com'],
  ['L-018', 'נדב צור', 'Facebook', R2, 'במעקב', 'נמוכה', 2200, 7, 'lead018@example.com'],
  ['L-019', 'רותם בן עמי', 'הפניה', R3, 'במעקב', 'גבוהה', 13000, 1, 'lead019@example.com'],
  ['L-020', 'עמית שגיא', 'Facebook', R4, 'במעקב', 'בינונית', 5500, null, 'lead020@example.com'],
  ['L-021', 'ענבל רוזן', 'אתר', R1, 'במעקב', 'גבוהה', 9500, 21, 'lead021@example.com'],
  // נסגר בהצלחה (5) - values 12,000 + 8,500 + 20,000 + 4,500 + 15,000 = 60,000
  ['L-022', 'תמר חכים', 'Google', R2, 'נסגר בהצלחה', 'גבוהה', 12000, -4, 'lead022@example.com'],
  ['L-023', 'בועז קדם', 'Facebook', R3, 'נסגר בהצלחה', 'בינונית', 8500, null, 'lead023@example.com'],
  ['L-024', 'יעל שטרן', 'הפניה', R4, 'נסגר בהצלחה', 'גבוהה', 20000, -10, 'lead024@example.com'],
  ['L-025', 'אביב נוי', 'אתר', R1, 'נסגר בהצלחה', 'נמוכה', 4500, null, 'lead025@example.com'],
  ['L-026', 'סיון עוז', 'Google', R2, 'נסגר בהצלחה', 'גבוהה', 15000, -1, 'lead026@example.com'],
  // נסגר ללא עסקה (4)
  ['L-027', 'עדי פרץ', 'Facebook', R3, 'נסגר ללא עסקה', 'נמוכה', 3000, -6, 'lead027@example.com'],
  ['L-028', 'גלעד מור', 'Google', R4, 'נסגר ללא עסקה', 'בינונית', 7500, null, ''],
  ['L-029', 'ליה סלע', 'הפניה', R1, 'נסגר ללא עסקה', 'נמוכה', 1800, null, 'lead029@example.com'],
  ['L-030', 'אריאל תמיר', 'אתר', R2, 'נסגר ללא עסקה', 'בינונית', 5000, -2, 'lead030@example.com'],
];

/** 30 demo leads with real dates relative to `today` ('YYYY-MM-DD'). Returns new objects on every call. */
export function createDemoLeads(today) {
  return TEMPLATES.map(([id, name, source, rep, status, interest, value, followUpOffset, email], index) => ({
    id,
    name,
    phone: '',
    email,
    source,
    rep,
    status,
    interest,
    value,
    followUpDate: followUpOffset === null ? null : addDays(today, followUpOffset),
    notes: '',
    createdAt: addDays(today, -45 + index),
  }));
}
