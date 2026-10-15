/**
 * Single source of truth for railway department names.
 *
 * Every layer — classification agent, staff registration, staff assignment,
 * officer dashboard — MUST resolve departments through these functions so the
 * names emitted by the classification agent always match the departments that
 * staff are registered under.
 */

const DEPARTMENTS = [
  'Mechanical',
  'Electrical',
  'Commercial/Catering',
  'Cleanliness/Housekeeping',
  'Civil/Infrastructure',
  'RPF/Security',
  'Medical/Health',
  'Operations/Train Control',
  'Station Administration',
  'Ticket Checking',
  'IT/Systems',
  'Safety',
];

const isValidDepartment = (value) => DEPARTMENTS.includes(String(value || '').trim());

/**
 * Map an arbitrary complaint/category/staff text to a canonical department
 * using keyword matching.
 */
function normalizeDepartment(value = '') {
  const v = String(value).toLowerCase();

  if (!v) return 'General';
  if (v.includes('electric') || v.includes('fan') || v.includes('ac') || v.includes('lighting') || v.includes('power') || v.includes('socket') || v.includes('circuit') || v.includes('wiring')) return 'Electrical';
  if (v.includes('clean') || v.includes('sanit') || v.includes('toilet') || v.includes('wash') || v.includes('garbage') || v.includes('hygiene') || v.includes('housekeeping') || v.includes('spill')) return 'Cleanliness/Housekeeping';
  if (v.includes('medical') || v.includes('injur') || v.includes('ambul') || v.includes('health') || v.includes('first aid') || v.includes('fever') || v.includes('sick')) return 'Medical/Health';
  if (v.includes('security') || v.includes('rpf') || v.includes('theft') || v.includes('harassment') || v.includes('assault') || v.includes('misconduct')) return 'RPF/Security';
  if (v.includes('cater') || v.includes('food') || v.includes('water') || v.includes('pantry') || v.includes('commercial') || v.includes('meal')) return 'Commercial/Catering';
  if (v.includes('guard') || v.includes('conductor') || v.includes('train control') || v.includes('operations') || v.includes('delay') || v.includes('schedule') || v.includes('signal') || v.includes('track')) return 'Operations/Train Control';
  if (v.includes('civil') || v.includes('infrastructure') || v.includes('construction') || v.includes('structural') || v.includes('p-way') || v.includes('permanent way')) return 'Civil/Infrastructure';
  if (v.includes('mechan') || v.includes('door') || v.includes('coach') || v.includes('berth') || v.includes('window') || v.includes('bogie') || v.includes('c&w')) return 'Mechanical';
  if (v.includes('station') || v.includes('platform') || v.includes('announcement') || v.includes('crowd') || v.includes('admin')) return 'Station Administration';
  if (v.includes('ticket') || v.includes('examiner') || v.includes('tt ')) return 'Ticket Checking';
  if (v.includes('it/') || v.includes('it-') || v.includes('software') || v.includes('digital') || v.includes('system')) return 'IT/Systems';
  if (v.includes('safety') || v.includes('fire') || v.includes('risk') || v.includes('danger') || v.includes('accident') || v.includes('slip')) return 'Safety';

  return 'General';
}

/**
 * Regex keyword → department mapping used by the officer dashboard when the
 * classification agent output is unavailable.
 */
function keywordToDepartment(text = '') {
  const value = String(text).toLowerCase();

  if (/(leak|leakage|seepage|dripping|drip|pipe|plumbing|overflow|flood|wet wall|roof leak|ac leak|water ingress|drain)/.test(value)) {
    return 'Mechanical';
  }
  if (/(clean|dirty|washroom|toilet|garbage|spill|sanit|odor|sewage|stink)/.test(value)) return 'Cleanliness/Housekeeping';
  if (/(light|fan|electrical|power|wiring|socket|panel|circuit|spark|door|signal|lift|escalator)/.test(value)) return 'Electrical';
  if (/(security|theft|harass|rpf|crowd|misconduct|ticket|aggressive|robbery)/.test(value)) return 'RPF/Security';
  if (/(medical|injury|ambulance|first aid|sick|health|fever|faint)/.test(value)) return 'Medical/Health';
  if (/(cater|pantry|food|water|meal|coffee|snack)/.test(value)) return 'Commercial/Catering';
  if (/(delay|schedule|train|rail|service|platform|announcement|track|signal|operations|control)/.test(value)) return 'Operations/Train Control';
  if (/(unsafe|safety|fire|slip|risk|accident|fallen|danger)/.test(value)) return 'Safety';
  return 'Operations/Train Control';
}

/**
 * Map a staff role/job title to the canonical department for registration.
 */
function roleToDepartment(role = '') {
  const roleLower = String(role).toLowerCase();

  if (roleLower.includes('ac') || roleLower.includes('electric')) return 'Electrical';
  if (roleLower.includes('rpf') || roleLower.includes('security')) return 'RPF/Security';
  if (roleLower.includes('medical') || roleLower.includes('health')) return 'Medical/Health';
  if (roleLower.includes('cater') || roleLower.includes('commercial') || roleLower.includes('pantry') || roleLower.includes('food')) return 'Commercial/Catering';
  if (roleLower.includes('guard') || roleLower.includes('conductor') || roleLower.includes('operations') || roleLower.includes('train control')) return 'Operations/Train Control';
  if (roleLower.includes('c&w') || roleLower.includes('mechan')) return 'Mechanical';
  if (roleLower.includes('ticket') || roleLower.includes('examiner') || roleLower.includes('tt')) return 'Ticket Checking';
  if (roleLower.includes('civil') || roleLower.includes('infrastructure') || roleLower.includes('p-way') || roleLower.includes('permanent way') || roleLower.includes('track')) return 'Civil/Infrastructure';
  if (/\bit\b/.test(roleLower) || roleLower.includes('software') || roleLower.includes('digital') || roleLower.includes('system admin') || roleLower.includes('sysadmin')) return 'IT/Systems';
  if (roleLower.includes('safety') || roleLower.includes('fire')) return 'Safety';
  if (roleLower.includes('clean') || roleLower.includes('sanit') || roleLower.includes('housekeep') || roleLower.includes('hygiene') || roleLower.includes('toilet')) return 'Cleanliness/Housekeeping';
  if (roleLower.includes('station') || roleLower.includes('platform') || roleLower.includes('enquiry')) return 'Station Administration';

  return 'Cleanliness/Housekeeping';
}

module.exports = {
  DEPARTMENTS,
  isValidDepartment,
  normalizeDepartment,
  keywordToDepartment,
  roleToDepartment,
};
