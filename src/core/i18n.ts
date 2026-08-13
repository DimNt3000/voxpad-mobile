/**
 * Two language interface, English and Greek. A string value can be plain text
 * or a function of its arguments. Ported from the web version of Voxpad, with
 * the platform specific strings (drag and drop, keyboard) swapped for their
 * mobile equivalents.
 */

export type UiLanguage = 'en' | 'el';

type Vars = Record<string, string | number>;
type Entry = string | ((vars: Vars) => string);

const SCRIPTS: Record<UiLanguage, Record<string, string>> = {
  en: { Greek: 'Greek', Cyrillic: 'Cyrillic', Arabic: 'Arabic', Hebrew: 'Hebrew' },
  el: { Greek: 'Ελληνικά', Cyrillic: 'Κυριλλικά', Arabic: 'Αραβικά', Hebrew: 'Εβραϊκά' },
};

const STRINGS: Record<UiLanguage, Record<string, Entry>> = {
  en: {
    'tagline': 'Text to speech that runs on your device.',

    'ui.theme': 'Theme',
    'ui.dark': 'Dark',
    'ui.light': 'Light',
    'ui.close': 'Close',
    'ui.language': 'Interface language',

    'tab.edit': 'Edit',
    'tab.read': 'Read',

    'doc.placeholder': 'Paste or type the text you want to hear.',
    'tool.import': 'Import file',
    'tool.sample': 'Sample',
    'tool.clear': 'Clear',
    'tool.clearConfirm': 'Confirm clear',

    'reader.empty': 'Nothing to read yet. Add some text in the Edit tab.',
    'reader.hint': 'Tap any sentence to start reading from there.',

    'voice.heading': 'Voice',
    'voice.pick': 'Choose a voice',
    'voice.none': 'No voices are installed on this device.',
    'voice.enhanced': 'Enhanced quality',
    'voice.hint': (v) => `This text is in ${v.script}. Use a matching voice?`,
    'voice.useMatch': 'Use it',
    'voice.count': (v) => `${v.n} ${v.n === 1 ? 'voice' : 'voices'}`,

    'delivery.heading': 'Delivery',
    'delivery.rate': 'Speed',
    'delivery.pitch': 'Pitch',
    'delivery.volume': 'Volume',
    'delivery.reset': 'Reset all',

    'preset.slow': 'Slow',
    'preset.normal': 'Normal',
    'preset.brisk': 'Brisk',

    'transport.prev': 'Previous sentence',
    'transport.play': 'Play',
    'transport.pause': 'Pause',
    'transport.resume': 'Resume',
    'transport.stop': 'Stop',
    'transport.next': 'Next sentence',
    'transport.seek': 'Reading position',

    'status.idle': 'Ready',
    'status.empty': 'Add some text to start.',
    'status.ready': (v) => `Ready, ${v.n} ${v.n === 1 ? 'sentence' : 'sentences'}.`,
    'status.speaking': (v) => `Reading sentence ${v.i} of ${v.n}.`,
    'status.paused': (v) => `Paused at sentence ${v.i} of ${v.n}.`,
    'status.done': 'Reached the end of the text.',

    'meta.counts': (v) => `${v.words} ${v.words === 1 ? 'word' : 'words'}, about ${v.duration}`,
    'meta.empty': 'No text yet.',

    'privacy.note': 'Your text stays on this device. Speech is produced by the system voices installed on it.',

    'error.speech': (v) => `The speech engine stopped with an error: ${v.error}.`,
    'error.fileType': 'That file is not plain text. Use .txt or .md.',
    'error.fileSize': 'That file is larger than 1 MB. Paste a smaller excerpt instead.',
    'error.fileRead': 'The file could not be read.',
  },

  el: {
    'tagline': 'Κείμενο σε ομιλία, τοπικά στη συσκευή σου.',

    'ui.theme': 'Θέμα',
    'ui.dark': 'Σκούρο',
    'ui.light': 'Φωτεινό',
    'ui.close': 'Κλείσιμο',
    'ui.language': 'Γλώσσα διεπαφής',

    'tab.edit': 'Σύνταξη',
    'tab.read': 'Ανάγνωση',

    'doc.placeholder': 'Επικόλλησε ή γράψε το κείμενο που θες να ακούσεις.',
    'tool.import': 'Άνοιγμα αρχείου',
    'tool.sample': 'Δείγμα',
    'tool.clear': 'Καθαρισμός',
    'tool.clearConfirm': 'Επιβεβαίωση',

    'reader.empty': 'Δεν υπάρχει κείμενο ακόμη. Πρόσθεσέ το στην καρτέλα Σύνταξη.',
    'reader.hint': 'Πάτησε σε οποιαδήποτε πρόταση για να ξεκινήσει η ανάγνωση από εκεί.',

    'voice.heading': 'Φωνή',
    'voice.pick': 'Διάλεξε φωνή',
    'voice.none': 'Δεν βρέθηκαν εγκατεστημένες φωνές στη συσκευή.',
    'voice.enhanced': 'Βελτιωμένη ποιότητα',
    'voice.hint': (v) => `Το κείμενο είναι στα ${v.script}. Να μπει αντίστοιχη φωνή;`,
    'voice.useMatch': 'Εφαρμογή',
    'voice.count': (v) => `${v.n} ${v.n === 1 ? 'φωνή' : 'φωνές'}`,

    'delivery.heading': 'Απόδοση',
    'delivery.rate': 'Ταχύτητα',
    'delivery.pitch': 'Τόνος',
    'delivery.volume': 'Ένταση',
    'delivery.reset': 'Επαναφορά',

    'preset.slow': 'Αργά',
    'preset.normal': 'Κανονικά',
    'preset.brisk': 'Γρήγορα',

    'transport.prev': 'Προηγούμενη πρόταση',
    'transport.play': 'Αναπαραγωγή',
    'transport.pause': 'Παύση',
    'transport.resume': 'Συνέχεια',
    'transport.stop': 'Διακοπή',
    'transport.next': 'Επόμενη πρόταση',
    'transport.seek': 'Θέση ανάγνωσης',

    'status.idle': 'Έτοιμο',
    'status.empty': 'Πρόσθεσε κείμενο για να ξεκινήσεις.',
    'status.ready': (v) => `Έτοιμο, ${v.n} ${v.n === 1 ? 'πρόταση' : 'προτάσεις'}.`,
    'status.speaking': (v) => `Διαβάζει την πρόταση ${v.i} από ${v.n}.`,
    'status.paused': (v) => `Παύση στην πρόταση ${v.i} από ${v.n}.`,
    'status.done': 'Έφτασε στο τέλος του κειμένου.',

    'meta.counts': (v) => `${v.words} ${v.words === 1 ? 'λέξη' : 'λέξεις'}, περίπου ${v.duration}`,
    'meta.empty': 'Δεν υπάρχει κείμενο ακόμη.',

    'privacy.note': 'Το κείμενό σου μένει στη συσκευή σου. Η ομιλία παράγεται από τις φωνές του συστήματος.',

    'error.speech': (v) => `Η μηχανή ομιλίας σταμάτησε με σφάλμα: ${v.error}.`,
    'error.fileType': 'Το αρχείο δεν είναι απλό κείμενο. Χρησιμοποίησε .txt ή .md.',
    'error.fileSize': 'Το αρχείο ξεπερνά το 1 MB. Επικόλλησε ένα μικρότερο απόσπασμα.',
    'error.fileRead': 'Το αρχείο δεν μπόρεσε να διαβαστεί.',
  },
};

const SAMPLES: Record<UiLanguage, string> = {
  en: 'Voxpad reads text out loud with the speech engine built into your phone. Nothing is uploaded, so the text you paste stays on this device.\n\nTry changing the voice and the speed while it reads. The sentence being spoken is highlighted as it goes, and you can tap any sentence to jump straight to it.',
  el: 'Το Voxpad διαβάζει κείμενο δυνατά, με τη μηχανή ομιλίας που είναι ήδη μέσα στο κινητό σου. Τίποτα δεν ανεβαίνει κάπου, οπότε το κείμενο μένει στη συσκευή σου.\n\nΔοκίμασε να αλλάξεις φωνή και ταχύτητα ενώ διαβάζει. Η πρόταση που ακούγεται φωτίζεται καθώς προχωρά, και μπορείς να πατήσεις οποιαδήποτε πρόταση για να πας κατευθείαν εκεί.',
};

export const LANGUAGES: UiLanguage[] = ['en', 'el'];

export function translate(lang: UiLanguage, key: string, vars?: Vars): string {
  const value = STRINGS[lang][key] ?? STRINGS.en[key];
  if (value === undefined) return key;
  return typeof value === 'function' ? value(vars || {}) : value;
}

export const sampleText = (lang: UiLanguage): string => SAMPLES[lang];

export const scriptName = (lang: UiLanguage, script: string): string =>
  SCRIPTS[lang]?.[script] || script;
